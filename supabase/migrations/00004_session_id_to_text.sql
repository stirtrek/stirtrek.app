-- ============================================================
-- Change sessions.id from UUID to TEXT
-- Sessionize returns mixed formats: UUIDs for regular sessions,
-- numeric strings (e.g. "840163") for service sessions.
-- ============================================================

-- Drop indexes that reference the columns we're changing
DROP INDEX IF EXISTS idx_session_speakers_session_id;
DROP INDEX IF EXISTS idx_session_speakers_speaker_id;
DROP INDEX IF EXISTS idx_session_feedback_session_id;

-- Drop foreign key constraints first
ALTER TABLE public.session_feedback DROP CONSTRAINT IF EXISTS session_feedback_session_id_fkey;
ALTER TABLE public.personal_schedule DROP CONSTRAINT IF EXISTS personal_schedule_session_id_fkey;
ALTER TABLE public.session_categories DROP CONSTRAINT IF EXISTS session_categories_session_id_fkey;
ALTER TABLE public.session_speakers DROP CONSTRAINT IF EXISTS session_speakers_session_id_fkey;

-- Change sessions.id from UUID to TEXT
ALTER TABLE public.sessions ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- Change all session_id foreign key columns to TEXT
ALTER TABLE public.session_speakers ALTER COLUMN session_id TYPE TEXT USING session_id::TEXT;
ALTER TABLE public.session_categories ALTER COLUMN session_id TYPE TEXT USING session_id::TEXT;
ALTER TABLE public.personal_schedule ALTER COLUMN session_id TYPE TEXT USING session_id::TEXT;
ALTER TABLE public.session_feedback ALTER COLUMN session_id TYPE TEXT USING session_id::TEXT;

-- Re-add foreign key constraints
ALTER TABLE public.session_speakers
  ADD CONSTRAINT session_speakers_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

ALTER TABLE public.session_categories
  ADD CONSTRAINT session_categories_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

ALTER TABLE public.personal_schedule
  ADD CONSTRAINT personal_schedule_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

ALTER TABLE public.session_feedback
  ADD CONSTRAINT session_feedback_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

-- Re-create indexes
CREATE INDEX idx_session_speakers_session_id ON public.session_speakers(session_id);
CREATE INDEX idx_session_speakers_speaker_id ON public.session_speakers(speaker_id);
CREATE INDEX idx_session_feedback_session_id ON public.session_feedback(session_id);
