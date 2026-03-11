-- ============================================================
-- PROCTOR ATTENDANCE COUNTING
-- Adds theaters (physical venue rooms), session-to-theater
-- mappings, attendance counts, and RLS policies.
-- (Depends on 00032 which adds the 'proctor' enum value.)
-- ============================================================

-- ============================================================
-- 1. THEATERS TABLE (all 28 physical theater rooms)
-- Separate from `rooms` which are Sessionize-synced schedule slots.
-- ============================================================
CREATE TABLE public.theaters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_theaters_event ON public.theaters(event_id);
CREATE INDEX idx_theaters_event_sort ON public.theaters(event_id, sort_order);

CREATE TRIGGER set_theaters_updated_at
  BEFORE UPDATE ON public.theaters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 2. THEATER_SESSIONS (maps sessions to physical theaters)
-- A session can play in multiple theaters (simulcast).
-- Uses TEXT session_id to match sessions.id (no FK to avoid
-- conflicts with Sessionize sync delete/recreate cycles).
-- ============================================================
CREATE TABLE public.theater_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  theater_id  UUID NOT NULL REFERENCES public.theaters(id) ON DELETE CASCADE,
  session_id  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, theater_id, session_id)
);

CREATE INDEX idx_theater_sessions_event ON public.theater_sessions(event_id);
CREATE INDEX idx_theater_sessions_theater ON public.theater_sessions(theater_id);
CREATE INDEX idx_theater_sessions_session ON public.theater_sessions(session_id);

-- ============================================================
-- 3. ATTENDANCE_COUNTS (one count per theater per session)
-- Upsert model: any proctor can insert or update.
-- ============================================================
CREATE TABLE public.attendance_counts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  theater_id  UUID NOT NULL REFERENCES public.theaters(id) ON DELETE CASCADE,
  session_id  TEXT NOT NULL,
  count       INTEGER NOT NULL CHECK (count >= 0),
  counted_by  UUID NOT NULL REFERENCES public.profiles(id),
  counted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, theater_id, session_id)
);

CREATE INDEX idx_attendance_counts_event ON public.attendance_counts(event_id);
CREATE INDEX idx_attendance_counts_session ON public.attendance_counts(session_id);
CREATE INDEX idx_attendance_counts_theater ON public.attendance_counts(theater_id);
CREATE INDEX idx_attendance_counts_event_session ON public.attendance_counts(event_id, session_id);

CREATE TRIGGER set_attendance_counts_updated_at
  BEFORE UPDATE ON public.attendance_counts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 4. RLS HELPER: is_event_proctor_or_above()
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
-- 5. RLS POLICIES
-- ============================================================

-- ----------------------------------------------------------
-- THEATERS
-- ----------------------------------------------------------
ALTER TABLE public.theaters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event members can read theaters"
  ON public.theaters FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_member()
  );

CREATE POLICY "Event admin can manage theaters"
  ON public.theaters FOR ALL
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- THEATER_SESSIONS
-- ----------------------------------------------------------
ALTER TABLE public.theater_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event proctor+ can read theater sessions"
  ON public.theater_sessions FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_proctor_or_above()
  );

CREATE POLICY "Event admin can manage theater sessions"
  ON public.theater_sessions FOR ALL
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
