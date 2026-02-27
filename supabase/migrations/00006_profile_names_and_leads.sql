-- ============================================================
-- ADD FIRST/LAST NAME AND SPONSOR FLAG TO PROFILES
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN first_name TEXT;
ALTER TABLE public.profiles ADD COLUMN last_name TEXT;
ALTER TABLE public.profiles ADD COLUMN is_sponsor BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- LEADS TABLE (sponsor badge scans)
-- ============================================================
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attendee_email TEXT NOT NULL,
  attendee_first_name TEXT,
  attendee_last_name TEXT,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leads_sponsor_attendee_unique UNIQUE (sponsor_profile_id, attendee_email)
);

CREATE INDEX idx_leads_sponsor_profile_id ON public.leads(sponsor_profile_id);
CREATE INDEX idx_leads_scanned_at ON public.leads(scanned_at DESC);

-- Auto-update updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- RLS FOR LEADS
-- ============================================================
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sponsors can read own leads" ON public.leads
  FOR SELECT USING (auth.uid() = sponsor_profile_id);
CREATE POLICY "Sponsors can insert own leads" ON public.leads
  FOR INSERT WITH CHECK (auth.uid() = sponsor_profile_id);
CREATE POLICY "Sponsors can update own leads" ON public.leads
  FOR UPDATE USING (auth.uid() = sponsor_profile_id);
CREATE POLICY "Sponsors can delete own leads" ON public.leads
  FOR DELETE USING (auth.uid() = sponsor_profile_id);
CREATE POLICY "Admin can read all leads" ON public.leads
  FOR SELECT USING (public.is_admin_or_staff());
