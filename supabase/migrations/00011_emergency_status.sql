-- ============================================================
-- Replace is_read BOOLEAN with status TEXT on emergency_messages
-- Values: 'unresponded', 'acknowledged', 'closed'
-- ============================================================

-- 1. Add status column
ALTER TABLE public.emergency_messages
  ADD COLUMN status TEXT NOT NULL DEFAULT 'unresponded';

-- 2. Migrate existing data
UPDATE public.emergency_messages SET status = 'acknowledged' WHERE is_read = TRUE;
UPDATE public.emergency_messages SET status = 'unresponded' WHERE is_read = FALSE;

-- 3. Drop old partial index that references is_read
DROP INDEX IF EXISTS idx_emergency_messages_unread;

-- 4. Drop is_read column
ALTER TABLE public.emergency_messages DROP COLUMN is_read;

-- 5. Add CHECK constraint
ALTER TABLE public.emergency_messages
  ADD CONSTRAINT emergency_messages_status_check
  CHECK (status IN ('unresponded', 'acknowledged', 'closed'));

-- 6. Indexes
CREATE INDEX idx_emergency_messages_status ON public.emergency_messages(status);
CREATE INDEX idx_emergency_messages_unresponded ON public.emergency_messages(status) WHERE status = 'unresponded';

-- 7. Enable REPLICA IDENTITY FULL so Supabase Realtime includes old record on UPDATE
ALTER TABLE public.emergency_messages REPLICA IDENTITY FULL;
