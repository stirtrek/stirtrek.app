-- Link speakers to user accounts so they can view their own session feedback.

ALTER TABLE public.speakers
  ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_speakers_user_id ON public.speakers(user_id);

-- Linked speakers can read feedback for their own sessions (anonymous — no user join)
CREATE POLICY "Linked speakers can read feedback for own sessions"
  ON public.session_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.speakers sp
      JOIN public.session_speakers ss ON ss.speaker_id = sp.id
      WHERE sp.user_id = auth.uid()
        AND ss.session_id = session_feedback.session_id
        AND sp.event_id = session_feedback.event_id
    )
  );
