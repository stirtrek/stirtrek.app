-- ============================================================
-- PROCTOR ATTENDANCE COUNTING
-- Adds session-to-room mappings (simulcast), attendance counts,
-- and RLS policies.
-- (Depends on 00032 which adds the 'proctor' enum value.)
--
-- Uses the existing `rooms` table for all venue rooms.
-- ============================================================

-- ============================================================
-- 1. SESSION_ROOMS (maps sessions to multiple rooms for simulcast)
-- The existing sessions.room_id tracks the primary/speaker room.
-- This junction table tracks ALL rooms a session plays in,
-- including simulcast rooms.
-- ============================================================
CREATE TABLE public.session_rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  room_id     INTEGER NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  session_id  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, room_id, session_id)
);

CREATE INDEX idx_session_rooms_event ON public.session_rooms(event_id);
CREATE INDEX idx_session_rooms_room ON public.session_rooms(room_id);
CREATE INDEX idx_session_rooms_session ON public.session_rooms(session_id);

-- ============================================================
-- 2. ATTENDANCE_COUNTS (one count per room per session)
-- Upsert model: any proctor can insert or update.
-- ============================================================
CREATE TABLE public.attendance_counts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  room_id     INTEGER NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  session_id  TEXT NOT NULL,
  count       INTEGER NOT NULL CHECK (count >= 0),
  counted_by  UUID NOT NULL REFERENCES public.profiles(id),
  counted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, room_id, session_id)
);

CREATE INDEX idx_attendance_counts_event ON public.attendance_counts(event_id);
CREATE INDEX idx_attendance_counts_session ON public.attendance_counts(session_id);
CREATE INDEX idx_attendance_counts_room ON public.attendance_counts(room_id);
CREATE INDEX idx_attendance_counts_event_session ON public.attendance_counts(event_id, session_id);

CREATE TRIGGER set_attendance_counts_updated_at
  BEFORE UPDATE ON public.attendance_counts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 3. RLS HELPER: is_event_proctor_or_above()
-- Returns TRUE for admin, staff, or proctor roles.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_event_proctor_or_above()
RETURNS BOOLEAN AS $$
  SELECT
    CASE
      WHEN public.current_event_id() IS NOT NULL THEN
        EXISTS (
          SELECT 1 FROM public.event_memberships
          WHERE user_id = auth.uid()
          AND event_id = public.current_event_id()
          AND role IN ('admin', 'staff', 'proctor')
        )
      ELSE
        EXISTS (
          SELECT 1 FROM public.event_memberships
          WHERE user_id = auth.uid()
          AND role IN ('admin', 'staff', 'proctor')
        )
    END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

-- ----------------------------------------------------------
-- SESSION_ROOMS
-- ----------------------------------------------------------
ALTER TABLE public.session_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event proctor+ can read session rooms"
  ON public.session_rooms FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_proctor_or_above()
  );

CREATE POLICY "Event admin can manage session rooms"
  ON public.session_rooms FOR ALL
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- ATTENDANCE_COUNTS
-- ----------------------------------------------------------
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
