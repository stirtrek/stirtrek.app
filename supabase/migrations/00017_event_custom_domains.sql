-- ============================================================
-- CUSTOM DOMAIN SUPPORT
-- Adds a domain column to events so each tenant can use
-- their own domain (e.g. stirtrek.app) to access the app.
-- The middleware checks the Host header against this column.
-- ============================================================

-- Add domain column (nullable, unique per domain)
ALTER TABLE public.events ADD COLUMN domain TEXT;

CREATE UNIQUE INDEX idx_events_domain ON public.events (domain)
  WHERE domain IS NOT NULL;

-- Set Stir Trek's custom domain
UPDATE public.events
  SET domain = 'stirtrek.app'
  WHERE id = '00000000-0000-0000-0000-000000000001';
