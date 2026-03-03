-- ============================================================
-- ANNOUNCEMENTS TABLE
-- ============================================================
CREATE TABLE public.announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  sent_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE TRIGGER set_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Admin/staff: full access
CREATE POLICY "Admin/staff full access to announcements"
  ON public.announcements
  FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

-- Authenticated users: read sent announcements only
CREATE POLICY "Authenticated users can read sent announcements"
  ON public.announcements
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND status = 'sent');

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_announcements_status ON public.announcements(status);
CREATE INDEX idx_announcements_sent_at ON public.announcements(sent_at DESC);

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
