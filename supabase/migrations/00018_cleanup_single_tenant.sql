-- ============================================================
-- PHASE 6 CLEANUP: REMOVE SINGLE-TENANT ARTIFACTS
--
-- Prerequisite: All clients now send x-event-id header.
-- This migration:
--   1. Removes RLS fallback clauses (OR current_event_id() IS NULL)
--   2. Simplifies helper functions (no more profiles.role fallback)
--   3. Drops old helper functions (is_admin_or_staff, is_admin)
--   4. Drops deprecated columns from profiles (role, is_sponsor, sponsor_id)
--   5. Drops old no-arg get_movie_vote_counts()
-- ============================================================

-- ============================================================
-- 1. UPDATE HELPER FUNCTIONS — remove profiles.role fallback
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_event_admin_or_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_memberships
    WHERE user_id = auth.uid()
    AND event_id = public.current_event_id()
    AND role IN ('admin', 'staff')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_event_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_memberships
    WHERE user_id = auth.uid()
    AND event_id = public.current_event_id()
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_event_member()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_memberships
    WHERE user_id = auth.uid()
    AND event_id = public.current_event_id()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 2. DROP OLD FUNCTIONS
-- ============================================================

DROP FUNCTION IF EXISTS public.is_admin_or_staff();
DROP FUNCTION IF EXISTS public.is_admin();
-- Drop old no-arg movie vote counts (event-scoped version remains)
DROP FUNCTION IF EXISTS public.get_movie_vote_counts();

-- ============================================================
-- 3. REMOVE FALLBACK CLAUSES FROM ALL POLICIES
--    Pattern: remove "OR public.current_event_id() IS NULL"
-- ============================================================

-- event_memberships
ALTER POLICY "Event admin can read event memberships"
  ON public.event_memberships
  USING (
    public.is_event_admin_or_staff()
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Event admin can manage event memberships"
  ON public.event_memberships
  USING (
    public.is_event_admin()
    AND event_id = public.current_event_id()
  );

-- rooms
ALTER POLICY "Event members can read rooms"
  ON public.rooms
  USING (
    event_id = public.current_event_id()
    AND public.is_event_member()
  );

ALTER POLICY "Event admin can manage rooms"
  ON public.rooms
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- categories
ALTER POLICY "Event members can read categories"
  ON public.categories
  USING (
    event_id = public.current_event_id()
    AND public.is_event_member()
  );

ALTER POLICY "Event admin can manage categories"
  ON public.categories
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- category_items
ALTER POLICY "Event members can read category_items"
  ON public.category_items
  USING (
    event_id = public.current_event_id()
    AND public.is_event_member()
  );

ALTER POLICY "Event admin can manage category_items"
  ON public.category_items
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- speakers
ALTER POLICY "Event members can read speakers"
  ON public.speakers
  USING (
    event_id = public.current_event_id()
    AND public.is_event_member()
  );

ALTER POLICY "Event admin can manage speakers"
  ON public.speakers
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- sessions
ALTER POLICY "Event members can read sessions"
  ON public.sessions
  USING (
    event_id = public.current_event_id()
    AND public.is_event_member()
  );

ALTER POLICY "Event admin can manage sessions"
  ON public.sessions
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- session_speakers
ALTER POLICY "Event members can read session_speakers"
  ON public.session_speakers
  USING (
    event_id = public.current_event_id()
    AND public.is_event_member()
  );

ALTER POLICY "Event admin can manage session_speakers"
  ON public.session_speakers
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- session_categories
ALTER POLICY "Event members can read session_categories"
  ON public.session_categories
  USING (
    event_id = public.current_event_id()
    AND public.is_event_member()
  );

ALTER POLICY "Event admin can manage session_categories"
  ON public.session_categories
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- personal_schedule
ALTER POLICY "Users can read own schedule"
  ON public.personal_schedule
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Users can add to own schedule"
  ON public.personal_schedule
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Users can remove from own schedule"
  ON public.personal_schedule
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Users can update own schedule"
  ON public.personal_schedule
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

-- session_feedback
ALTER POLICY "Users can read own feedback"
  ON public.session_feedback
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Users can insert own feedback"
  ON public.session_feedback
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Users can update own feedback"
  ON public.session_feedback
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Event admin can read all feedback"
  ON public.session_feedback
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- movies
ALTER POLICY "Event members can read active movies"
  ON public.movies
  USING (
    event_id = public.current_event_id()
    AND public.is_event_member()
    AND is_active = TRUE
  );

ALTER POLICY "Event admin can read all movies"
  ON public.movies
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

ALTER POLICY "Event admin can manage movies"
  ON public.movies
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- movie_votes
ALTER POLICY "Users can read own vote"
  ON public.movie_votes
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Users can cast vote"
  ON public.movie_votes
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Users can change vote"
  ON public.movie_votes
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Users can delete own vote"
  ON public.movie_votes
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Event admin can read all votes"
  ON public.movie_votes
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- sponsors
ALTER POLICY "Event members can read active sponsors"
  ON public.sponsors
  USING (
    event_id = public.current_event_id()
    AND public.is_event_member()
    AND is_active = TRUE
  );

ALTER POLICY "Event admin can read all sponsors"
  ON public.sponsors
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

ALTER POLICY "Event admin can manage sponsors"
  ON public.sponsors
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- leads
ALTER POLICY "Sponsors can read own leads"
  ON public.leads
  USING (
    auth.uid() = sponsor_profile_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Sponsors can insert own leads"
  ON public.leads
  USING (
    auth.uid() = sponsor_profile_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Sponsors can update own leads"
  ON public.leads
  USING (
    auth.uid() = sponsor_profile_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Sponsors can delete own leads"
  ON public.leads
  USING (
    auth.uid() = sponsor_profile_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Event admin can read all leads"
  ON public.leads
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- polls
ALTER POLICY "Event members can read active polls"
  ON public.polls
  USING (
    event_id = public.current_event_id()
    AND public.is_event_member()
    AND status = 'active'
  );

ALTER POLICY "Event admin can read all polls"
  ON public.polls
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

ALTER POLICY "Event admin can manage polls"
  ON public.polls
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- poll_options
ALTER POLICY "Event members can read options for active polls"
  ON public.poll_options
  USING (
    event_id = public.current_event_id()
    AND public.is_event_member()
    AND EXISTS (
      SELECT 1 FROM public.polls WHERE id = poll_id AND status = 'active'
    )
  );

ALTER POLICY "Event admin can read all poll options"
  ON public.poll_options
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

ALTER POLICY "Event admin can manage poll options"
  ON public.poll_options
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- poll_responses
ALTER POLICY "Users can read own poll responses"
  ON public.poll_responses
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Users can insert poll response"
  ON public.poll_responses
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Users can delete own poll responses"
  ON public.poll_responses
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Event admin can read all poll responses"
  ON public.poll_responses
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- emergency_reports
ALTER POLICY "Users can insert emergency reports"
  ON public.emergency_reports
  USING (
    (auth.uid() = user_id OR user_id IS NULL)
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Users can read own reports"
  ON public.emergency_reports
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Event admin can read all reports"
  ON public.emergency_reports
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

ALTER POLICY "Event admin can update reports"
  ON public.emergency_reports
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- emergency_messages
ALTER POLICY "Users can insert own emergency messages"
  ON public.emergency_messages
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Users can read own emergency messages"
  ON public.emergency_messages
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Event admin can read all emergency messages"
  ON public.emergency_messages
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

ALTER POLICY "Event admin can update emergency messages"
  ON public.emergency_messages
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- emergency_replies
ALTER POLICY "Event admin can insert emergency replies"
  ON public.emergency_replies
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
    AND auth.uid() = sender_id
  );

ALTER POLICY "Users can reply to own messages"
  ON public.emergency_replies
  USING (
    event_id = public.current_event_id()
    AND auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.emergency_messages
      WHERE id = message_id AND user_id = auth.uid()
    )
  );

ALTER POLICY "Event admin can read all emergency replies"
  ON public.emergency_replies
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

ALTER POLICY "Users can read replies to own messages"
  ON public.emergency_replies
  USING (
    event_id = public.current_event_id()
    AND EXISTS (
      SELECT 1 FROM public.emergency_messages
      WHERE id = message_id AND user_id = auth.uid()
    )
  );

ALTER POLICY "Users can update replies to own messages"
  ON public.emergency_replies
  USING (
    event_id = public.current_event_id()
    AND EXISTS (
      SELECT 1 FROM public.emergency_messages
      WHERE id = message_id AND user_id = auth.uid()
    )
  );

-- announcements
DROP POLICY "Event admin full access to announcements" ON public.announcements;
CREATE POLICY "Event admin full access to announcements"
  ON public.announcements FOR ALL
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  )
  WITH CHECK (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

ALTER POLICY "Event members can read sent announcements"
  ON public.announcements
  USING (
    event_id = public.current_event_id()
    AND public.is_event_member()
    AND status = 'sent'
  );

-- venue_maps
ALTER POLICY "Event members can read active venue maps"
  ON public.venue_maps
  USING (
    event_id = public.current_event_id()
    AND public.is_event_member()
    AND is_active = TRUE
  );

ALTER POLICY "Event admin can read all venue maps"
  ON public.venue_maps
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

ALTER POLICY "Event admin can manage venue maps"
  ON public.venue_maps
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- app_settings
ALTER POLICY "Event members can read settings"
  ON public.app_settings
  USING (
    event_id = public.current_event_id()
    AND public.is_event_member()
  );

ALTER POLICY "Event admin can manage settings"
  ON public.app_settings
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin()
  );

-- push_subscriptions
ALTER POLICY "Users can manage own subscriptions"
  ON public.push_subscriptions
  USING (
    auth.uid() = user_id
    AND event_id = public.current_event_id()
  );

ALTER POLICY "Event admin can read subscriptions"
  ON public.push_subscriptions
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- sessionize_sync_log
ALTER POLICY "Event admin can read sync log"
  ON public.sessionize_sync_log
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

ALTER POLICY "Event admin can insert sync log"
  ON public.sessionize_sync_log
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

ALTER POLICY "Event admin can update sync log"
  ON public.sessionize_sync_log
  USING (
    event_id = public.current_event_id()
    AND public.is_event_admin_or_staff()
  );

-- profiles (remove NULL fallback)
DROP POLICY "Event admin can read event member profiles" ON public.profiles;
CREATE POLICY "Event admin can read event member profiles"
  ON public.profiles FOR SELECT
  USING (
    public.is_event_admin_or_staff()
    AND EXISTS (
      SELECT 1 FROM public.event_memberships em
      WHERE em.user_id = id
      AND em.event_id = public.current_event_id()
    )
  );

DROP POLICY "Event admin can update event member profiles" ON public.profiles;
CREATE POLICY "Event admin can update event member profiles"
  ON public.profiles FOR UPDATE
  USING (
    public.is_event_admin()
    AND EXISTS (
      SELECT 1 FROM public.event_memberships em
      WHERE em.user_id = id
      AND em.event_id = public.current_event_id()
    )
  );

-- ============================================================
-- 4. DROP DEPRECATED COLUMNS FROM PROFILES
-- These have been migrated to event_memberships.
-- ============================================================

ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_sponsor;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS sponsor_id;
