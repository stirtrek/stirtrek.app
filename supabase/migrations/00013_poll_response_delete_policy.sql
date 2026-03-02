-- Allow users to delete their own poll response so they can change their vote.
CREATE POLICY "Users can delete own poll response" ON public.poll_responses
  FOR DELETE USING (auth.uid() = user_id);
