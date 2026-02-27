-- Rename admin_id to sender_id to support replies from both admins and the original sender
ALTER TABLE public.emergency_replies RENAME COLUMN admin_id TO sender_id;

-- Add RLS policy allowing users to reply to their own messages
CREATE POLICY "Users can reply to own messages"
  ON public.emergency_replies
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.emergency_messages
      WHERE id = message_id AND user_id = auth.uid()
    )
  );

-- Update the existing admin insert policy to use sender_id
DROP POLICY IF EXISTS "Admin can insert emergency replies" ON public.emergency_replies;
CREATE POLICY "Admin can insert emergency replies"
  ON public.emergency_replies
  FOR INSERT WITH CHECK (public.is_admin_or_staff() AND auth.uid() = sender_id);
