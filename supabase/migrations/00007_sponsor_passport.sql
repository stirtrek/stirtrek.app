-- ============================================================
-- SPONSOR PASSPORT: Link sponsor accounts to sponsor companies
-- ============================================================

-- Add sponsor company foreign key to profiles
-- Nullable: existing sponsor accounts will have NULL until assigned
ALTER TABLE public.profiles
  ADD COLUMN sponsor_id UUID REFERENCES public.sponsors(id) ON DELETE SET NULL;

CREATE INDEX idx_profiles_sponsor_id ON public.profiles(sponsor_id);

-- Index leads by attendee email for passport query performance
CREATE INDEX idx_leads_attendee_email ON public.leads(attendee_email);
