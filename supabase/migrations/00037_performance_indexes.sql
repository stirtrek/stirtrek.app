-- Performance indexes for high-concurrency event day load.
-- Each index targets a composite filter used in a hot query path
-- that currently falls back to a bitmap merge or per-row scan.

CREATE INDEX IF NOT EXISTS idx_session_feedback_event_user
    ON public.session_feedback(event_id, user_id);

CREATE INDEX IF NOT EXISTS idx_poll_responses_poll_user
    ON public.poll_responses(poll_id, user_id);

CREATE INDEX IF NOT EXISTS idx_event_memberships_event_sponsor
    ON public.event_memberships(event_id, is_sponsor);

CREATE INDEX IF NOT EXISTS idx_sponsors_event_active_sort
    ON public.sponsors(event_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_speakers_event_user
    ON public.speakers(event_id, user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_personal_schedule_event_session
    ON public.personal_schedule(event_id, session_id);

CREATE INDEX IF NOT EXISTS idx_announcements_event_status_sent
    ON public.announcements(event_id, status, sent_at DESC);

-- Aggregate bookmark stats in SQL instead of pulling every row into the
-- admin dashboard process. Returns top 10 sessions by bookmark count
-- alongside the totals needed to render the dashboard.
CREATE OR REPLACE FUNCTION public.get_event_bookmark_stats(p_event_id UUID)
RETURNS TABLE (
    total_bookmarks BIGINT,
    unique_bookmarkers BIGINT,
    top_session_id TEXT,
    top_session_title TEXT,
    top_session_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH totals AS (
        SELECT
            COUNT(*)::BIGINT AS total_bookmarks,
            COUNT(DISTINCT user_id)::BIGINT AS unique_bookmarkers
        FROM public.personal_schedule
        WHERE event_id = p_event_id
    ),
    top_sessions AS (
        SELECT
            ps.session_id,
            s.title,
            COUNT(*)::BIGINT AS bookmark_count
        FROM public.personal_schedule ps
        LEFT JOIN public.sessions s
            ON s.id = ps.session_id AND s.event_id = p_event_id
        WHERE ps.event_id = p_event_id
        GROUP BY ps.session_id, s.title
        ORDER BY bookmark_count DESC
        LIMIT 10
    )
    SELECT
        t.total_bookmarks,
        t.unique_bookmarkers,
        ts.session_id,
        ts.title,
        ts.bookmark_count
    FROM totals t
    LEFT JOIN top_sessions ts ON TRUE;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_bookmark_stats(UUID) TO authenticated, service_role;
