-- Allow upsert on personal_schedule by adding the missing UPDATE policy.
-- Without this, upsert (INSERT ... ON CONFLICT DO UPDATE) returns 403.
CREATE POLICY "Users can update own schedule" ON public.personal_schedule
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
