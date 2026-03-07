-- Add scheduled_for column for scheduling announcements
ALTER TABLE public.announcements
  ADD COLUMN scheduled_for TIMESTAMPTZ;

-- Update status check constraint to allow 'scheduled'
ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_status_check;
ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_status_check
  CHECK (status IN ('draft', 'scheduled', 'sent'));

-- Index for the cron query: find scheduled announcements ready to send
CREATE INDEX idx_announcements_scheduled
  ON public.announcements (status, scheduled_for)
  WHERE status = 'scheduled';
