-- ============================================================
-- EMERGENCY MESSAGES (simple free-text from any user to admins)
-- ============================================================
CREATE TABLE public.emergency_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EMERGENCY REPLIES (threaded replies from admins or the original sender)
-- ============================================================
CREATE TABLE public.emergency_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.emergency_messages(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reply TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_emergency_messages_user_id ON public.emergency_messages(user_id);
CREATE INDEX idx_emergency_messages_unread ON public.emergency_messages(is_read) WHERE is_read = FALSE;
CREATE INDEX idx_emergency_messages_created_at ON public.emergency_messages(created_at DESC);
CREATE INDEX idx_emergency_replies_message_id ON public.emergency_replies(message_id);
CREATE INDEX idx_emergency_replies_unread ON public.emergency_replies(is_read) WHERE is_read = FALSE;

-- ============================================================
-- AUTO-UPDATE TRIGGER
-- ============================================================
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.emergency_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE public.emergency_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_replies ENABLE ROW LEVEL SECURITY;

-- Users can insert their own messages
CREATE POLICY "Users can insert own emergency messages"
  ON public.emergency_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own messages
CREATE POLICY "Users can read own emergency messages"
  ON public.emergency_messages
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can read all messages
CREATE POLICY "Admin can read all emergency messages"
  ON public.emergency_messages
  FOR SELECT USING (public.is_admin_or_staff());

-- Admins can update messages (mark as read)
CREATE POLICY "Admin can update emergency messages"
  ON public.emergency_messages
  FOR UPDATE USING (public.is_admin_or_staff());

-- Admins can insert replies to any message
CREATE POLICY "Admin can insert emergency replies"
  ON public.emergency_replies
  FOR INSERT WITH CHECK (public.is_admin_or_staff() AND auth.uid() = sender_id);

-- Users can insert replies to their own messages
CREATE POLICY "Users can reply to own messages"
  ON public.emergency_replies
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.emergency_messages
      WHERE id = message_id AND user_id = auth.uid()
    )
  );

-- Admins can read all replies
CREATE POLICY "Admin can read all emergency replies"
  ON public.emergency_replies
  FOR SELECT USING (public.is_admin_or_staff());

-- Users can read replies to their own messages
CREATE POLICY "Users can read replies to own messages"
  ON public.emergency_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.emergency_messages
      WHERE id = message_id AND user_id = auth.uid()
    )
  );

-- Users can update replies to their own messages (mark as read)
CREATE POLICY "Users can update replies to own messages"
  ON public.emergency_replies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.emergency_messages
      WHERE id = message_id AND user_id = auth.uid()
    )
  );

-- ============================================================
-- ENABLE REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_replies;
