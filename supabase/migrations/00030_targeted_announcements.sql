-- Add targeting support to announcements so organizers can send to specific segments.

ALTER TABLE public.announcements
  ADD COLUMN target_type TEXT NOT NULL DEFAULT 'all'
    CHECK (target_type IN ('all', 'roles', 'speakers', 'sponsors', 'track')),
  ADD COLUMN target_criteria JSONB DEFAULT NULL;

-- target_criteria examples:
--   all:      null
--   roles:    { "roles": ["admin", "staff"] }
--   speakers: null
--   sponsors: null
--   track:    { "category_item_ids": [42, 55] }

COMMENT ON COLUMN public.announcements.target_type IS 'Audience segment: all, roles, speakers, sponsors, or track';
COMMENT ON COLUMN public.announcements.target_criteria IS 'JSON criteria for the target segment (e.g. role list, category IDs)';
