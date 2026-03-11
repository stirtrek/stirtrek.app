-- ============================================================
-- SIMULCAST ROOMS + ATTENDANCE MODEL REFACTOR
-- Replaces per-session room mappings with per-event simulcast
-- groups, and changes attendance_counts from session-keyed to
-- time-slot-keyed.
--
-- Handles the original 00033 schema which used theater_id and
-- had separate theaters/theater_sessions tables.
-- ============================================================

-- ============================================================
-- 1. SIMULCAST_ROOMS (one-time per-event room groupings)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.simulcast_rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  source_room_id  INTEGER NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  target_room_id  INTEGER NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, source_room_id, target_room_id),
  CHECK (source_room_id <> target_room_id)
);

CREATE INDEX IF NOT EXISTS idx_simulcast_rooms_event ON public.simulcast_rooms(event_id);
CREATE INDEX IF NOT EXISTS idx_simulcast_rooms_source ON public.simulcast_rooms(source_room_id);

-- ============================================================
-- 2. REBUILD ATTENDANCE_COUNTS
-- The existing table may have theater_id (UUID) or room_id (INT)
-- depending on which version of 00033 was applied. Easiest to
-- drop and recreate since there is no production data yet.
-- ============================================================
DROP TABLE IF EXISTS public.attendance_counts CASCADE;

CREATE TABLE public.attendance_counts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  room_id     INTEGER NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  time_slot   TIMESTAMPTZ NOT NULL,
  count       INTEGER NOT NULL CHECK (count >= 0),
  counted_by  UUID NOT NULL REFERENCES public.profiles(id),
  counted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, room_id, time_slot)
);

CREATE INDEX idx_attendance_counts_event ON public.attendance_counts(event_id);
CREATE INDEX idx_attendance_counts_room ON public.attendance_counts(room_id);
CREATE INDEX idx_attendance_counts_event_timeslot ON public.attendance_counts(event_id, time_slot);

CREATE TRIGGER set_attendance_counts_updated_at
  BEFORE UPDATE ON public.attendance_counts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 3. DROP OLD TABLES (from either version of 00033)
-- ============================================================
DROP TABLE IF EXISTS public.session_rooms CASCADE;
DROP TABLE IF EXISTS public.theater_sessions CASCADE;
DROP TABLE IF EXISTS public.theaters CASCADE;

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

-- SIMULCAST_ROOMS
ALTER TABLE public.simulcast_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event proctor+ can read simulcast rooms"
  ON public.simulcast_rooms FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_proctor_or_above()
  );

CREATE POLICY "Event admin can manage simulcast rooms"
  ON public.simulcast_rooms FOR ALL
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ATTENDANCE_COUNTS (recreated, so needs fresh RLS)
ALTER TABLE public.attendance_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event proctor+ can read attendance counts"
  ON public.attendance_counts FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_proctor_or_above()
  );

CREATE POLICY "Event proctor+ can insert attendance counts"
  ON public.attendance_counts FOR INSERT
  WITH CHECK (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_proctor_or_above()
    AND auth.uid() = counted_by
  );

CREATE POLICY "Event proctor+ can update attendance counts"
  ON public.attendance_counts FOR UPDATE
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_proctor_or_above()
  );

CREATE POLICY "Event admin can delete attendance counts"
  ON public.attendance_counts FOR DELETE
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );
