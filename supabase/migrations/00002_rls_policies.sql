-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessionize_sync_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS FOR ROLE CHECKS
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin_or_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'staff')
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Admin can read all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin_or_staff());
CREATE POLICY "Admin can update any profile" ON public.profiles
  FOR UPDATE USING (public.is_admin());

-- ============================================================
-- READ-ONLY PUBLIC TABLES (authenticated can read, admin can write)
-- ============================================================

-- ROOMS
CREATE POLICY "Authenticated users can read rooms" ON public.rooms
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin can manage rooms" ON public.rooms
  FOR ALL USING (public.is_admin_or_staff());

-- CATEGORIES
CREATE POLICY "Authenticated users can read categories" ON public.categories
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin can manage categories" ON public.categories
  FOR ALL USING (public.is_admin_or_staff());

-- CATEGORY ITEMS
CREATE POLICY "Authenticated users can read category_items" ON public.category_items
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin can manage category_items" ON public.category_items
  FOR ALL USING (public.is_admin_or_staff());

-- SPEAKERS
CREATE POLICY "Authenticated users can read speakers" ON public.speakers
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin can manage speakers" ON public.speakers
  FOR ALL USING (public.is_admin_or_staff());

-- SESSIONS
CREATE POLICY "Authenticated users can read sessions" ON public.sessions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin can manage sessions" ON public.sessions
  FOR ALL USING (public.is_admin_or_staff());

-- SESSION_SPEAKERS
CREATE POLICY "Authenticated users can read session_speakers" ON public.session_speakers
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin can manage session_speakers" ON public.session_speakers
  FOR ALL USING (public.is_admin_or_staff());

-- SESSION_CATEGORIES
CREATE POLICY "Authenticated users can read session_categories" ON public.session_categories
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin can manage session_categories" ON public.session_categories
  FOR ALL USING (public.is_admin_or_staff());

-- SPONSORS
CREATE POLICY "Authenticated users can read active sponsors" ON public.sponsors
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = TRUE);
CREATE POLICY "Admin can read all sponsors" ON public.sponsors
  FOR SELECT USING (public.is_admin_or_staff());
CREATE POLICY "Admin can manage sponsors" ON public.sponsors
  FOR ALL USING (public.is_admin_or_staff());

-- VENUE MAPS
CREATE POLICY "Authenticated users can read active venue_maps" ON public.venue_maps
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = TRUE);
CREATE POLICY "Admin can read all venue_maps" ON public.venue_maps
  FOR SELECT USING (public.is_admin_or_staff());
CREATE POLICY "Admin can manage venue_maps" ON public.venue_maps
  FOR ALL USING (public.is_admin_or_staff());

-- ============================================================
-- PERSONAL SCHEDULE
-- ============================================================
CREATE POLICY "Users can read own schedule" ON public.personal_schedule
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add to own schedule" ON public.personal_schedule
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove from own schedule" ON public.personal_schedule
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- SESSION FEEDBACK
-- ============================================================
CREATE POLICY "Users can read own feedback" ON public.session_feedback
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own feedback" ON public.session_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own feedback" ON public.session_feedback
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admin can read all feedback" ON public.session_feedback
  FOR SELECT USING (public.is_admin_or_staff());

-- ============================================================
-- MOVIES
-- ============================================================
CREATE POLICY "Authenticated users can read active movies" ON public.movies
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = TRUE);
CREATE POLICY "Admin can read all movies" ON public.movies
  FOR SELECT USING (public.is_admin_or_staff());
CREATE POLICY "Admin can manage movies" ON public.movies
  FOR ALL USING (public.is_admin_or_staff());

-- ============================================================
-- MOVIE VOTES
-- ============================================================
CREATE POLICY "Users can read own vote" ON public.movie_votes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can cast vote" ON public.movie_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can change vote" ON public.movie_votes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own vote" ON public.movie_votes
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admin can read all votes" ON public.movie_votes
  FOR SELECT USING (public.is_admin_or_staff());

-- ============================================================
-- POLLS
-- ============================================================
CREATE POLICY "Authenticated users can read active polls" ON public.polls
  FOR SELECT USING (auth.role() = 'authenticated' AND status = 'active');
CREATE POLICY "Admin can read all polls" ON public.polls
  FOR SELECT USING (public.is_admin_or_staff());
CREATE POLICY "Admin can manage polls" ON public.polls
  FOR ALL USING (public.is_admin_or_staff());

-- POLL OPTIONS
CREATE POLICY "Authenticated users can read options for active polls" ON public.poll_options
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.polls WHERE id = poll_id AND status = 'active'
    )
  );
CREATE POLICY "Admin can read all poll options" ON public.poll_options
  FOR SELECT USING (public.is_admin_or_staff());
CREATE POLICY "Admin can manage poll options" ON public.poll_options
  FOR ALL USING (public.is_admin_or_staff());

-- POLL RESPONSES
CREATE POLICY "Users can read own poll responses" ON public.poll_responses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert poll response" ON public.poll_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can read all poll responses" ON public.poll_responses
  FOR SELECT USING (public.is_admin_or_staff());

-- ============================================================
-- EMERGENCY REPORTS
-- ============================================================
CREATE POLICY "Users can insert emergency reports" ON public.emergency_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can read own reports" ON public.emergency_reports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin can read all reports" ON public.emergency_reports
  FOR SELECT USING (public.is_admin_or_staff());
CREATE POLICY "Admin can update reports" ON public.emergency_reports
  FOR UPDATE USING (public.is_admin_or_staff());

-- ============================================================
-- APP SETTINGS
-- ============================================================
CREATE POLICY "Authenticated users can read settings" ON public.app_settings
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin can manage settings" ON public.app_settings
  FOR ALL USING (public.is_admin());

-- ============================================================
-- PUSH SUBSCRIPTIONS
-- ============================================================
CREATE POLICY "Users can manage own subscriptions" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admin can read subscriptions" ON public.push_subscriptions
  FOR SELECT USING (public.is_admin_or_staff());

-- ============================================================
-- SESSIONIZE SYNC LOG
-- ============================================================
CREATE POLICY "Admin can read sync log" ON public.sessionize_sync_log
  FOR SELECT USING (public.is_admin_or_staff());
CREATE POLICY "Admin can insert sync log" ON public.sessionize_sync_log
  FOR INSERT WITH CHECK (public.is_admin_or_staff());
CREATE POLICY "Admin can update sync log" ON public.sessionize_sync_log
  FOR UPDATE USING (public.is_admin_or_staff());
