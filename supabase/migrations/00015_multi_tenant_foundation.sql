-- ============================================================
-- MULTI-TENANT FOUNDATION
-- Adds event_id scoping to all event-specific tables,
-- creates the events table and event_memberships table,
-- and migrates existing data to belong to Stir Trek 2026.
-- ============================================================

-- ============================================================
-- 1. CREATE EVENTS TABLE (the tenant anchor)
-- ============================================================
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  logo_url TEXT,
  event_date DATE,
  event_end_date DATE,
  venue_name TEXT,
  venue_address TEXT,
  venue_maps_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  sessionize_api_id TEXT,
  sponsor_feed_url TEXT,
  sponsor_access_code TEXT,
  feature_flags JSONB NOT NULL DEFAULT '{
    "polls": true,
    "movie_voting": false,
    "emergency_reporting": true,
    "sponsor_leads": true,
    "announcements": true,
    "feedback": true,
    "venue_map": true,
    "passport": true
  }'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 2. INSERT STIR TREK AS THE FIRST EVENT
-- ============================================================
INSERT INTO public.events (
  id, slug, name, short_name, event_date, venue_name, venue_address,
  venue_maps_url, timezone, feature_flags
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'stirtrek',
  'Stir Trek 2026',
  'Stir Trek',
  '2026-05-01',
  'AMC Easton Town Center 30',
  '275 Easton Town Ctr, Columbus, OH 43219',
  'https://maps.google.com/?q=AMC+Easton+Town+Center+30',
  'America/New_York',
  '{
    "polls": true,
    "movie_voting": true,
    "emergency_reporting": true,
    "sponsor_leads": true,
    "announcements": true,
    "feedback": true,
    "venue_map": true,
    "passport": true
  }'::jsonb
);

-- ============================================================
-- 3. ADD event_id COLUMNS (nullable first for backfill)
-- ============================================================

-- Sessionize content tables
ALTER TABLE public.rooms ADD COLUMN event_id UUID REFERENCES public.events(id);
ALTER TABLE public.categories ADD COLUMN event_id UUID REFERENCES public.events(id);
ALTER TABLE public.category_items ADD COLUMN event_id UUID REFERENCES public.events(id);
ALTER TABLE public.speakers ADD COLUMN event_id UUID REFERENCES public.events(id);
ALTER TABLE public.sessions ADD COLUMN event_id UUID REFERENCES public.events(id);

-- Junction tables
ALTER TABLE public.session_speakers ADD COLUMN event_id UUID REFERENCES public.events(id);
ALTER TABLE public.session_categories ADD COLUMN event_id UUID REFERENCES public.events(id);

-- Attendee engagement tables
ALTER TABLE public.personal_schedule ADD COLUMN event_id UUID REFERENCES public.events(id);
ALTER TABLE public.session_feedback ADD COLUMN event_id UUID REFERENCES public.events(id);

-- Movie tables
ALTER TABLE public.movies ADD COLUMN event_id UUID REFERENCES public.events(id);
ALTER TABLE public.movie_votes ADD COLUMN event_id UUID REFERENCES public.events(id);

-- Sponsor tables
ALTER TABLE public.sponsors ADD COLUMN event_id UUID REFERENCES public.events(id);
ALTER TABLE public.leads ADD COLUMN event_id UUID REFERENCES public.events(id);

-- Poll tables
ALTER TABLE public.polls ADD COLUMN event_id UUID REFERENCES public.events(id);
ALTER TABLE public.poll_options ADD COLUMN event_id UUID REFERENCES public.events(id);
ALTER TABLE public.poll_responses ADD COLUMN event_id UUID REFERENCES public.events(id);

-- Emergency tables
ALTER TABLE public.emergency_reports ADD COLUMN event_id UUID REFERENCES public.events(id);
ALTER TABLE public.emergency_messages ADD COLUMN event_id UUID REFERENCES public.events(id);
ALTER TABLE public.emergency_replies ADD COLUMN event_id UUID REFERENCES public.events(id);

-- Other event-scoped tables
ALTER TABLE public.announcements ADD COLUMN event_id UUID REFERENCES public.events(id);
ALTER TABLE public.venue_maps ADD COLUMN event_id UUID REFERENCES public.events(id);
ALTER TABLE public.push_subscriptions ADD COLUMN event_id UUID REFERENCES public.events(id);
ALTER TABLE public.sessionize_sync_log ADD COLUMN event_id UUID REFERENCES public.events(id);

-- app_settings needs special handling (composite PK change)
ALTER TABLE public.app_settings ADD COLUMN event_id UUID REFERENCES public.events(id);

-- ============================================================
-- 4. BACKFILL ALL EXISTING DATA WITH STIR TREK EVENT ID
-- ============================================================
UPDATE public.rooms SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.categories SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.category_items SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.speakers SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.sessions SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.session_speakers SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.session_categories SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.personal_schedule SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.session_feedback SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.movies SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.movie_votes SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.sponsors SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.leads SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.polls SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.poll_options SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.poll_responses SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.emergency_reports SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.emergency_messages SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.emergency_replies SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.announcements SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.venue_maps SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.push_subscriptions SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.sessionize_sync_log SET event_id = '00000000-0000-0000-0000-000000000001';
UPDATE public.app_settings SET event_id = '00000000-0000-0000-0000-000000000001';

-- ============================================================
-- 5. MAKE event_id NOT NULL
-- ============================================================
ALTER TABLE public.rooms ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.categories ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.category_items ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.speakers ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.sessions ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.session_speakers ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.session_categories ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.personal_schedule ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.session_feedback ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.movies ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.movie_votes ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.sponsors ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.leads ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.polls ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.poll_options ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.poll_responses ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.emergency_reports ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.emergency_messages ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.emergency_replies ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.announcements ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.venue_maps ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.push_subscriptions ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.sessionize_sync_log ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.app_settings ALTER COLUMN event_id SET NOT NULL;

-- ============================================================
-- 6. CREATE EVENT MEMBERSHIPS TABLE
-- ============================================================
CREATE TABLE public.event_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'attendee',
  is_sponsor BOOLEAN NOT NULL DEFAULT FALSE,
  sponsor_id UUID REFERENCES public.sponsors(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_memberships_user ON public.event_memberships(user_id);
CREATE INDEX idx_event_memberships_event ON public.event_memberships(event_id);
CREATE INDEX idx_event_memberships_event_role ON public.event_memberships(event_id, role);

-- Auto-create a trigger for event_memberships (no updated_at needed, just joined_at)

-- ============================================================
-- 7. MIGRATE EXISTING PROFILE DATA INTO EVENT MEMBERSHIPS
-- ============================================================
INSERT INTO public.event_memberships (event_id, user_id, role, is_sponsor, sponsor_id)
SELECT
  '00000000-0000-0000-0000-000000000001',
  id,
  role,
  is_sponsor,
  sponsor_id
FROM public.profiles;

-- ============================================================
-- 8. ADD is_super_admin TO PROFILES
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Bootstrap: mark current admins as super-admins
UPDATE public.profiles SET is_super_admin = TRUE WHERE role = 'admin';

-- ============================================================
-- 9. UPDATE UNIQUE CONSTRAINTS
-- ============================================================

-- movie_votes: one vote per user PER EVENT (was per user globally)
ALTER TABLE public.movie_votes DROP CONSTRAINT movie_votes_user_id_key;
ALTER TABLE public.movie_votes ADD CONSTRAINT movie_votes_event_user_unique UNIQUE(event_id, user_id);

-- leads: unique sponsor+attendee PER EVENT
ALTER TABLE public.leads DROP CONSTRAINT leads_sponsor_attendee_unique;
ALTER TABLE public.leads ADD CONSTRAINT leads_event_sponsor_attendee_unique UNIQUE(event_id, sponsor_profile_id, attendee_email);

-- app_settings: key is per-event now (composite PK)
ALTER TABLE public.app_settings DROP CONSTRAINT app_settings_pkey;
ALTER TABLE public.app_settings ADD PRIMARY KEY (event_id, key);

-- ============================================================
-- 10. CREATE NEW COMPOSITE INDEXES (event_id as leading column)
-- ============================================================

-- Sessions
CREATE INDEX idx_sessions_event ON public.sessions(event_id);
CREATE INDEX idx_sessions_event_starts ON public.sessions(event_id, starts_at);
CREATE INDEX idx_sessions_event_room ON public.sessions(event_id, room_id);

-- Rooms
CREATE INDEX idx_rooms_event ON public.rooms(event_id);

-- Categories
CREATE INDEX idx_categories_event ON public.categories(event_id);

-- Speakers
CREATE INDEX idx_speakers_event ON public.speakers(event_id);

-- Personal schedule
CREATE INDEX idx_personal_schedule_event_user ON public.personal_schedule(event_id, user_id);

-- Session feedback
CREATE INDEX idx_session_feedback_event ON public.session_feedback(event_id);

-- Movies
CREATE INDEX idx_movies_event ON public.movies(event_id);

-- Sponsors
CREATE INDEX idx_sponsors_event ON public.sponsors(event_id);

-- Leads
CREATE INDEX idx_leads_event ON public.leads(event_id);

-- Polls
CREATE INDEX idx_polls_event ON public.polls(event_id);
CREATE INDEX idx_polls_event_status ON public.polls(event_id, status);

-- Emergency
CREATE INDEX idx_emergency_reports_event ON public.emergency_reports(event_id);
CREATE INDEX idx_emergency_reports_event_status ON public.emergency_reports(event_id, status);
CREATE INDEX idx_emergency_messages_event ON public.emergency_messages(event_id);
CREATE INDEX idx_emergency_messages_event_status ON public.emergency_messages(event_id, status);

-- Announcements
CREATE INDEX idx_announcements_event ON public.announcements(event_id);
CREATE INDEX idx_announcements_event_status ON public.announcements(event_id, status);

-- Push subscriptions
CREATE INDEX idx_push_subscriptions_event_user ON public.push_subscriptions(event_id, user_id);

-- Sync log
CREATE INDEX idx_sessionize_sync_log_event ON public.sessionize_sync_log(event_id);

-- Venue maps
CREATE INDEX idx_venue_maps_event ON public.venue_maps(event_id);

-- ============================================================
-- 11. ENABLE RLS ON NEW TABLES
-- ============================================================
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_memberships ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 12. ENABLE REALTIME ON EVENTS TABLE
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_memberships;
