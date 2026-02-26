-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- AUTO-UPDATE updated_at TIMESTAMP
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.speakers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.movies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sponsors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.polls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.emergency_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.session_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.venue_maps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- AGGREGATION FUNCTIONS (SECURITY DEFINER to avoid leaking individual data)
-- ============================================================

-- Get aggregated movie vote counts
CREATE OR REPLACE FUNCTION public.get_movie_vote_counts()
RETURNS TABLE (movie_id UUID, vote_count BIGINT) AS $$
  SELECT movie_id, COUNT(*) as vote_count
  FROM public.movie_votes
  GROUP BY movie_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Get aggregated poll results
CREATE OR REPLACE FUNCTION public.get_poll_results(p_poll_id UUID)
RETURNS TABLE (option_id UUID, option_text TEXT, vote_count BIGINT) AS $$
  SELECT po.id, po.text, COUNT(pr.id) as vote_count
  FROM public.poll_options po
  LEFT JOIN public.poll_responses pr ON pr.option_id = po.id
  WHERE po.poll_id = p_poll_id
  GROUP BY po.id, po.text
  ORDER BY po.sort_order;
$$ LANGUAGE sql SECURITY DEFINER;

-- Get feedback summary for a session
CREATE OR REPLACE FUNCTION public.get_session_feedback_summary(p_session_id UUID)
RETURNS TABLE (rating public.feedback_rating, count BIGINT) AS $$
  SELECT rating, COUNT(*) as count
  FROM public.session_feedback
  WHERE session_id = p_session_id
  GROUP BY rating;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- EMERGENCY REPORT NOTIFICATION TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_emergency_report()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('emergency_report', json_build_object(
    'id', NEW.id,
    'category', NEW.category,
    'severity', NEW.severity,
    'title', NEW.title,
    'created_at', NEW.created_at
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_emergency_report_created
  AFTER INSERT ON public.emergency_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_emergency_report();
