-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.user_role AS ENUM ('attendee', 'admin', 'staff');

CREATE TYPE public.emergency_category AS ENUM (
  'person_safety',
  'av_problem',
  'facility_issue',
  'medical',
  'other'
);

CREATE TYPE public.emergency_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE public.emergency_status AS ENUM ('new', 'acknowledged', 'in_progress', 'resolved');

CREATE TYPE public.sponsor_tier AS ENUM ('platinum', 'gold', 'silver', 'bronze', 'community');

CREATE TYPE public.poll_status AS ENUM ('draft', 'active', 'closed');

CREATE TYPE public.feedback_rating AS ENUM ('red', 'yellow', 'green');

CREATE TYPE public.sync_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role public.user_role NOT NULL DEFAULT 'attendee',
  phone TEXT,
  receives_sms_alerts BOOLEAN NOT NULL DEFAULT FALSE,
  receives_push_alerts BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROOMS (from Sessionize)
-- ============================================================
CREATE TABLE public.rooms (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES (from Sessionize)
-- ============================================================
CREATE TABLE public.categories (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  category_type TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.category_items (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- SPEAKERS (from Sessionize)
-- ============================================================
CREATE TABLE public.speakers (
  id UUID PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  bio TEXT,
  tag_line TEXT,
  profile_picture TEXT,
  is_top_speaker BOOLEAN NOT NULL DEFAULT FALSE,
  links JSONB NOT NULL DEFAULT '[]',
  sessionize_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SESSIONS (from Sessionize)
-- ============================================================
CREATE TABLE public.sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  room_id INTEGER REFERENCES public.rooms(id),
  is_service_session BOOLEAN NOT NULL DEFAULT FALSE,
  is_plenum_session BOOLEAN NOT NULL DEFAULT FALSE,
  live_url TEXT,
  recording_url TEXT,
  status TEXT,
  sessionize_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- JUNCTION TABLES
-- ============================================================
CREATE TABLE public.session_speakers (
  session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  speaker_id UUID NOT NULL REFERENCES public.speakers(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, speaker_id)
);

CREATE TABLE public.session_categories (
  session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  category_item_id INTEGER NOT NULL REFERENCES public.category_items(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, category_item_id)
);

-- ============================================================
-- PERSONAL SCHEDULE (attendee bookmarks)
-- ============================================================
CREATE TABLE public.personal_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

-- ============================================================
-- SESSION FEEDBACK
-- ============================================================
CREATE TABLE public.session_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  rating public.feedback_rating NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

-- ============================================================
-- MOVIES
-- ============================================================
CREATE TABLE public.movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  poster_url TEXT,
  trailer_url TEXT,
  genre TEXT,
  runtime_minutes INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.movie_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  movie_id UUID NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- SPONSORS
-- ============================================================
CREATE TABLE public.sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tier public.sponsor_tier NOT NULL,
  logo_url TEXT,
  description TEXT,
  website_url TEXT,
  booth_location TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- POLLS
-- ============================================================
CREATE TABLE public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  description TEXT,
  status public.poll_status NOT NULL DEFAULT 'draft',
  allow_multiple BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.poll_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

-- ============================================================
-- EMERGENCY REPORTS
-- ============================================================
CREATE TABLE public.emergency_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  category public.emergency_category NOT NULL,
  severity public.emergency_severity NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  status public.emergency_status NOT NULL DEFAULT 'new',
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  staff_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SESSIONIZE SYNC LOG
-- ============================================================
CREATE TABLE public.sessionize_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status public.sync_status NOT NULL DEFAULT 'pending',
  triggered_by UUID REFERENCES public.profiles(id),
  sessions_synced INTEGER DEFAULT 0,
  speakers_synced INTEGER DEFAULT 0,
  rooms_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- VENUE MAPS
-- ============================================================
CREATE TABLE public.venue_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  floor TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- APP SETTINGS (key-value config store)
-- ============================================================
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- PUSH SUBSCRIPTIONS (multi-device support)
-- ============================================================
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_sessions_starts_at ON public.sessions(starts_at);
CREATE INDEX idx_sessions_room_id ON public.sessions(room_id);
CREATE INDEX idx_session_speakers_speaker_id ON public.session_speakers(speaker_id);
CREATE INDEX idx_session_speakers_session_id ON public.session_speakers(session_id);
CREATE INDEX idx_personal_schedule_user_id ON public.personal_schedule(user_id);
CREATE INDEX idx_session_feedback_session_id ON public.session_feedback(session_id);
CREATE INDEX idx_session_feedback_user_id ON public.session_feedback(user_id);
CREATE INDEX idx_movie_votes_movie_id ON public.movie_votes(movie_id);
CREATE INDEX idx_poll_responses_poll_id ON public.poll_responses(poll_id);
CREATE INDEX idx_emergency_reports_status ON public.emergency_reports(status);
CREATE INDEX idx_emergency_reports_created_at ON public.emergency_reports(created_at DESC);
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- ============================================================
-- ENABLE REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
