ALTER TABLE public.polls
ADD COLUMN scheduled_open TIMESTAMPTZ,
ADD COLUMN scheduled_close TIMESTAMPTZ;
