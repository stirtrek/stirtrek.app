-- ============================================================
-- MULTI-TENANT RLS POLICIES (FALLBACK-TOLERANT)
-- Creates event-scoped helper functions and updates all
-- RLS policies to enforce tenant isolation.
--
-- FALLBACK STRATEGY: All policies use the pattern:
--   (event_id = current_event_id() OR current_event_id() IS NULL)
-- This means:
--   - When x-event-id header IS set: strict tenant isolation
--   - When x-event-id header is NOT set: behaves like old policies
-- The fallback will be removed in Phase 6 cleanup once all
-- clients send the header.
-- ============================================================

-- ============================================================
-- 1. NEW HELPER FUNCTIONS
-- ============================================================

-- Extract event_id from Supabase request headers
-- Returns NULL when header is missing (enabling fallback)
CREATE OR REPLACE FUNCTION public.current_event_id()
RETURNS UUID AS $$
  SELECT NULLIF(
    current_setting('request.headers', true)::json->>'x-event-id',
    ''
  )::uuid;
$$ LANGUAGE sql STABLE;

-- Check if current user is admin/staff for the current event.
-- When no event header is set, falls back to old profiles.role check.
CREATE OR REPLACE FUNCTION public.is_event_admin_or_staff()
RETURNS BOOLEAN AS $$
  SELECT
    CASE
      WHEN public.current_event_id() IS NOT NULL THEN
        EXISTS (
          SELECT 1 FROM public.event_memberships
          WHERE user_id = auth.uid()
          AND event_id = public.current_event_id()
          AND role IN ('admin', 'staff')
        )
      ELSE
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role IN ('admin', 'staff')
        )
    END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is admin for the current event.
-- When no event header is set, falls back to old profiles.role check.
CREATE OR REPLACE FUNCTION public.is_event_admin()
RETURNS BOOLEAN AS $$
  SELECT
    CASE
      WHEN public.current_event_id() IS NOT NULL THEN
        EXISTS (
          SELECT 1 FROM public.event_memberships
          WHERE user_id = auth.uid()
          AND event_id = public.current_event_id()
          AND role = 'admin'
        )
      ELSE
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
          AND role = 'admin'
        )
    END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is a member of the current event.
-- When no event header is set, always returns TRUE (anyone authenticated).
CREATE OR REPLACE FUNCTION public.is_event_member()
RETURNS BOOLEAN AS $$
  SELECT
    CASE
      WHEN public.current_event_id() IS NOT NULL THEN
        EXISTS (
          SELECT 1 FROM public.event_memberships
          WHERE user_id = auth.uid()
          AND event_id = public.current_event_id()
        )
      ELSE
        (auth.uid() IS NOT NULL)
    END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is a super-admin (global)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND is_super_admin = TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 2. EVENTS TABLE POLICIES
-- ============================================================
CREATE POLICY "Anyone can read active events"
  ON public.events
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Super-admin can manage events"
  ON public.events
  FOR ALL USING (public.is_super_admin());

-- ============================================================
-- 3. EVENT MEMBERSHIPS POLICIES
-- ============================================================
CREATE POLICY "Users can read own memberships"
  ON public.event_memberships
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Event admin can read event memberships"
  ON public.event_memberships
  FOR SELECT USING (
    public.is_event_admin_or_staff()
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Event admin can manage event memberships"
  ON public.event_memberships
  FOR ALL USING (
    public.is_event_admin()
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Super-admin can manage all memberships"
  ON public.event_memberships
  FOR ALL USING (public.is_super_admin());

-- ============================================================
-- 4. DROP OLD POLICIES AND CREATE EVENT-SCOPED REPLACEMENTS
-- ============================================================

-- ----------------------------------------------------------
-- ROOMS
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read rooms" ON public.rooms;
DROP POLICY IF EXISTS "Admin can manage rooms" ON public.rooms;

CREATE POLICY "Event members can read rooms"
  ON public.rooms FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_member()
  );

CREATE POLICY "Event admin can manage rooms"
  ON public.rooms FOR ALL
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- CATEGORIES
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read categories" ON public.categories;
DROP POLICY IF EXISTS "Admin can manage categories" ON public.categories;

CREATE POLICY "Event members can read categories"
  ON public.categories FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_member()
  );

CREATE POLICY "Event admin can manage categories"
  ON public.categories FOR ALL
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- CATEGORY ITEMS
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read category_items" ON public.category_items;
DROP POLICY IF EXISTS "Admin can manage category_items" ON public.category_items;

CREATE POLICY "Event members can read category_items"
  ON public.category_items FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_member()
  );

CREATE POLICY "Event admin can manage category_items"
  ON public.category_items FOR ALL
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- SPEAKERS
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read speakers" ON public.speakers;
DROP POLICY IF EXISTS "Admin can manage speakers" ON public.speakers;

CREATE POLICY "Event members can read speakers"
  ON public.speakers FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_member()
  );

CREATE POLICY "Event admin can manage speakers"
  ON public.speakers FOR ALL
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- SESSIONS
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read sessions" ON public.sessions;
DROP POLICY IF EXISTS "Admin can manage sessions" ON public.sessions;

CREATE POLICY "Event members can read sessions"
  ON public.sessions FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_member()
  );

CREATE POLICY "Event admin can manage sessions"
  ON public.sessions FOR ALL
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- SESSION_SPEAKERS
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read session_speakers" ON public.session_speakers;
DROP POLICY IF EXISTS "Admin can manage session_speakers" ON public.session_speakers;

CREATE POLICY "Event members can read session_speakers"
  ON public.session_speakers FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_member()
  );

CREATE POLICY "Event admin can manage session_speakers"
  ON public.session_speakers FOR ALL
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- SESSION_CATEGORIES
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read session_categories" ON public.session_categories;
DROP POLICY IF EXISTS "Admin can manage session_categories" ON public.session_categories;

CREATE POLICY "Event members can read session_categories"
  ON public.session_categories FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_member()
  );

CREATE POLICY "Event admin can manage session_categories"
  ON public.session_categories FOR ALL
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- PERSONAL SCHEDULE
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own schedule" ON public.personal_schedule;
DROP POLICY IF EXISTS "Users can add to own schedule" ON public.personal_schedule;
DROP POLICY IF EXISTS "Users can remove from own schedule" ON public.personal_schedule;
DROP POLICY IF EXISTS "Users can update own schedule" ON public.personal_schedule;

CREATE POLICY "Users can read own schedule"
  ON public.personal_schedule FOR SELECT
  USING (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Users can add to own schedule"
  ON public.personal_schedule FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Users can remove from own schedule"
  ON public.personal_schedule FOR DELETE
  USING (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Users can update own schedule"
  ON public.personal_schedule FOR UPDATE
  USING (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

-- ----------------------------------------------------------
-- SESSION FEEDBACK
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own feedback" ON public.session_feedback;
DROP POLICY IF EXISTS "Users can insert own feedback" ON public.session_feedback;
DROP POLICY IF EXISTS "Users can update own feedback" ON public.session_feedback;
DROP POLICY IF EXISTS "Admin can read all feedback" ON public.session_feedback;

CREATE POLICY "Users can read own feedback"
  ON public.session_feedback FOR SELECT
  USING (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Users can insert own feedback"
  ON public.session_feedback FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Users can update own feedback"
  ON public.session_feedback FOR UPDATE
  USING (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Event admin can read all feedback"
  ON public.session_feedback FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- MOVIES
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read active movies" ON public.movies;
DROP POLICY IF EXISTS "Admin can read all movies" ON public.movies;
DROP POLICY IF EXISTS "Admin can manage movies" ON public.movies;

CREATE POLICY "Event members can read active movies"
  ON public.movies FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_member()
    AND is_active = TRUE
  );

CREATE POLICY "Event admin can read all movies"
  ON public.movies FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

CREATE POLICY "Event admin can manage movies"
  ON public.movies FOR ALL
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- MOVIE VOTES
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own vote" ON public.movie_votes;
DROP POLICY IF EXISTS "Users can cast vote" ON public.movie_votes;
DROP POLICY IF EXISTS "Users can change vote" ON public.movie_votes;
DROP POLICY IF EXISTS "Users can delete own vote" ON public.movie_votes;
DROP POLICY IF EXISTS "Admin can read all votes" ON public.movie_votes;

CREATE POLICY "Users can read own vote"
  ON public.movie_votes FOR SELECT
  USING (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Users can cast vote"
  ON public.movie_votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Users can change vote"
  ON public.movie_votes FOR UPDATE
  USING (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Users can delete own vote"
  ON public.movie_votes FOR DELETE
  USING (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Event admin can read all votes"
  ON public.movie_votes FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- SPONSORS
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read active sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "Admin can read all sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "Admin can manage sponsors" ON public.sponsors;

CREATE POLICY "Event members can read active sponsors"
  ON public.sponsors FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_member()
    AND is_active = TRUE
  );

CREATE POLICY "Event admin can read all sponsors"
  ON public.sponsors FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

CREATE POLICY "Event admin can manage sponsors"
  ON public.sponsors FOR ALL
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- LEADS
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Sponsors can read own leads" ON public.leads;
DROP POLICY IF EXISTS "Sponsors can insert own leads" ON public.leads;
DROP POLICY IF EXISTS "Sponsors can update own leads" ON public.leads;
DROP POLICY IF EXISTS "Sponsors can delete own leads" ON public.leads;
DROP POLICY IF EXISTS "Admin can read all leads" ON public.leads;

CREATE POLICY "Sponsors can read own leads"
  ON public.leads FOR SELECT
  USING (
    auth.uid() = sponsor_profile_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Sponsors can insert own leads"
  ON public.leads FOR INSERT
  WITH CHECK (
    auth.uid() = sponsor_profile_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Sponsors can update own leads"
  ON public.leads FOR UPDATE
  USING (
    auth.uid() = sponsor_profile_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Sponsors can delete own leads"
  ON public.leads FOR DELETE
  USING (
    auth.uid() = sponsor_profile_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Event admin can read all leads"
  ON public.leads FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- POLLS
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read active polls" ON public.polls;
DROP POLICY IF EXISTS "Admin can read all polls" ON public.polls;
DROP POLICY IF EXISTS "Admin can manage polls" ON public.polls;

CREATE POLICY "Event members can read active polls"
  ON public.polls FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_member()
    AND status = 'active'
  );

CREATE POLICY "Event admin can read all polls"
  ON public.polls FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

CREATE POLICY "Event admin can manage polls"
  ON public.polls FOR ALL
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- POLL OPTIONS
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read options for active polls" ON public.poll_options;
DROP POLICY IF EXISTS "Admin can read all poll options" ON public.poll_options;
DROP POLICY IF EXISTS "Admin can manage poll options" ON public.poll_options;

CREATE POLICY "Event members can read options for active polls"
  ON public.poll_options FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_member()
    AND EXISTS (
      SELECT 1 FROM public.polls WHERE id = poll_id AND status = 'active'
    )
  );

CREATE POLICY "Event admin can read all poll options"
  ON public.poll_options FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

CREATE POLICY "Event admin can manage poll options"
  ON public.poll_options FOR ALL
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- POLL RESPONSES
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own poll responses" ON public.poll_responses;
DROP POLICY IF EXISTS "Users can insert poll response" ON public.poll_responses;
DROP POLICY IF EXISTS "Users can delete own poll responses" ON public.poll_responses;
DROP POLICY IF EXISTS "Admin can read all poll responses" ON public.poll_responses;

CREATE POLICY "Users can read own poll responses"
  ON public.poll_responses FOR SELECT
  USING (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Users can insert poll response"
  ON public.poll_responses FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Users can delete own poll responses"
  ON public.poll_responses FOR DELETE
  USING (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Event admin can read all poll responses"
  ON public.poll_responses FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- EMERGENCY REPORTS
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert emergency reports" ON public.emergency_reports;
DROP POLICY IF EXISTS "Users can read own reports" ON public.emergency_reports;
DROP POLICY IF EXISTS "Admin can read all reports" ON public.emergency_reports;
DROP POLICY IF EXISTS "Admin can update reports" ON public.emergency_reports;

CREATE POLICY "Users can insert emergency reports"
  ON public.emergency_reports FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id OR user_id IS NULL)
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Users can read own reports"
  ON public.emergency_reports FOR SELECT
  USING (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Event admin can read all reports"
  ON public.emergency_reports FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

CREATE POLICY "Event admin can update reports"
  ON public.emergency_reports FOR UPDATE
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- EMERGENCY MESSAGES
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own emergency messages" ON public.emergency_messages;
DROP POLICY IF EXISTS "Users can read own emergency messages" ON public.emergency_messages;
DROP POLICY IF EXISTS "Admin can read all emergency messages" ON public.emergency_messages;
DROP POLICY IF EXISTS "Admin can update emergency messages" ON public.emergency_messages;

CREATE POLICY "Users can insert own emergency messages"
  ON public.emergency_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Users can read own emergency messages"
  ON public.emergency_messages FOR SELECT
  USING (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Event admin can read all emergency messages"
  ON public.emergency_messages FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

CREATE POLICY "Event admin can update emergency messages"
  ON public.emergency_messages FOR UPDATE
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- EMERGENCY REPLIES
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Admin can insert emergency replies" ON public.emergency_replies;
DROP POLICY IF EXISTS "Users can reply to own messages" ON public.emergency_replies;
DROP POLICY IF EXISTS "Admin can read all emergency replies" ON public.emergency_replies;
DROP POLICY IF EXISTS "Users can read replies to own messages" ON public.emergency_replies;
DROP POLICY IF EXISTS "Users can update replies to own messages" ON public.emergency_replies;

CREATE POLICY "Event admin can insert emergency replies"
  ON public.emergency_replies FOR INSERT
  WITH CHECK (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
    AND auth.uid() = sender_id
  );

CREATE POLICY "Users can reply to own messages"
  ON public.emergency_replies FOR INSERT
  WITH CHECK (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.emergency_messages
      WHERE id = message_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Event admin can read all emergency replies"
  ON public.emergency_replies FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

CREATE POLICY "Users can read replies to own messages"
  ON public.emergency_replies FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND EXISTS (
      SELECT 1 FROM public.emergency_messages
      WHERE id = message_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update replies to own messages"
  ON public.emergency_replies FOR UPDATE
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND EXISTS (
      SELECT 1 FROM public.emergency_messages
      WHERE id = message_id AND user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------
-- ANNOUNCEMENTS
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Admin/staff full access to announcements" ON public.announcements;
DROP POLICY IF EXISTS "Authenticated users can read sent announcements" ON public.announcements;

CREATE POLICY "Event admin full access to announcements"
  ON public.announcements FOR ALL
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  )
  WITH CHECK (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

CREATE POLICY "Event members can read sent announcements"
  ON public.announcements FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_member()
    AND status = 'sent'
  );

-- ----------------------------------------------------------
-- VENUE MAPS
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read active venue_maps" ON public.venue_maps;
DROP POLICY IF EXISTS "Admin can read all venue_maps" ON public.venue_maps;
DROP POLICY IF EXISTS "Admin can manage venue_maps" ON public.venue_maps;

CREATE POLICY "Event members can read active venue maps"
  ON public.venue_maps FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_member()
    AND is_active = TRUE
  );

CREATE POLICY "Event admin can read all venue maps"
  ON public.venue_maps FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

CREATE POLICY "Event admin can manage venue maps"
  ON public.venue_maps FOR ALL
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- APP SETTINGS
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admin can manage settings" ON public.app_settings;

CREATE POLICY "Event members can read settings"
  ON public.app_settings FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_member()
  );

CREATE POLICY "Event admin can manage settings"
  ON public.app_settings FOR ALL
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin()
  );

-- ----------------------------------------------------------
-- PUSH SUBSCRIPTIONS
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Admin can read subscriptions" ON public.push_subscriptions;

CREATE POLICY "Users can manage own subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (
    auth.uid() = user_id
    AND (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
  );

CREATE POLICY "Event admin can read subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- SESSIONIZE SYNC LOG
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Admin can read sync log" ON public.sessionize_sync_log;
DROP POLICY IF EXISTS "Admin can insert sync log" ON public.sessionize_sync_log;
DROP POLICY IF EXISTS "Admin can update sync log" ON public.sessionize_sync_log;

CREATE POLICY "Event admin can read sync log"
  ON public.sessionize_sync_log FOR SELECT
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

CREATE POLICY "Event admin can insert sync log"
  ON public.sessionize_sync_log FOR INSERT
  WITH CHECK (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

CREATE POLICY "Event admin can update sync log"
  ON public.sessionize_sync_log FOR UPDATE
  USING (
    (event_id = public.current_event_id() OR public.current_event_id() IS NULL)
    AND public.is_event_admin_or_staff()
  );

-- ----------------------------------------------------------
-- PROFILES (updated — add event-scoped admin read)
-- ----------------------------------------------------------
-- Keep existing profile policies (users read/update own)
-- but update the admin policy to scope by event membership

DROP POLICY IF EXISTS "Admin can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;

CREATE POLICY "Event admin can read event member profiles"
  ON public.profiles FOR SELECT
  USING (
    public.is_event_admin_or_staff()
    AND (
      public.current_event_id() IS NULL
      OR EXISTS (
        SELECT 1 FROM public.event_memberships em
        WHERE em.user_id = profiles.id
        AND em.event_id = public.current_event_id()
      )
    )
  );

CREATE POLICY "Event admin can update event member profiles"
  ON public.profiles FOR UPDATE
  USING (
    public.is_event_admin()
    AND (
      public.current_event_id() IS NULL
      OR EXISTS (
        SELECT 1 FROM public.event_memberships em
        WHERE em.user_id = profiles.id
        AND em.event_id = public.current_event_id()
      )
    )
  );

CREATE POLICY "Super-admin can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Super-admin can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.is_super_admin());

-- ============================================================
-- 5. UPDATE AGGREGATION FUNCTIONS FOR EVENT SCOPING
-- ============================================================

-- Movie vote counts now need event_id parameter
CREATE OR REPLACE FUNCTION public.get_movie_vote_counts(p_event_id UUID)
RETURNS TABLE (movie_id UUID, vote_count BIGINT) AS $$
  SELECT movie_id, COUNT(*) as vote_count
  FROM public.movie_votes
  WHERE event_id = p_event_id
  GROUP BY movie_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Keep the old no-arg version working for now (uses all events)
-- Will be removed in cleanup phase

-- Poll results already scoped by poll_id (which is event-scoped), no change needed

-- Session feedback summary needs event awareness
CREATE OR REPLACE FUNCTION public.get_session_feedback_summary(p_session_id TEXT)
RETURNS TABLE (rating public.feedback_rating, count BIGINT) AS $$
  SELECT rating, COUNT(*) as count
  FROM public.session_feedback
  WHERE session_id = p_session_id
  GROUP BY rating;
$$ LANGUAGE sql SECURITY DEFINER;
