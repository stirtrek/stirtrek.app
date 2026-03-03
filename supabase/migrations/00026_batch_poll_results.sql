-- Batch version of get_poll_results: accepts an array of poll IDs
-- and returns results for all of them in a single call.
CREATE OR REPLACE FUNCTION public.get_poll_results_batch(p_poll_ids UUID[])
RETURNS TABLE (poll_id UUID, option_id UUID, option_text TEXT, vote_count BIGINT) AS $$
  SELECT po.poll_id, po.id, po.text, COUNT(pr.id) as vote_count
  FROM public.poll_options po
  LEFT JOIN public.poll_responses pr ON pr.option_id = po.id
  WHERE po.poll_id = ANY(p_poll_ids)
  GROUP BY po.poll_id, po.id, po.text
  ORDER BY po.poll_id, po.sort_order;
$$ LANGUAGE sql SECURITY DEFINER;
