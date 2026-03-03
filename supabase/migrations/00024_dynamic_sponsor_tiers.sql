-- ============================================================
-- Dynamic per-event sponsor tiers
-- ============================================================

-- 1. Add sponsor_tiers JSONB column to events with default matching current 5 tiers
ALTER TABLE events
  ADD COLUMN sponsor_tiers JSONB NOT NULL DEFAULT '[
    {"key": "platinum", "label": "Platinum", "sort_order": 0, "has_booth": true},
    {"key": "gold",     "label": "Gold",     "sort_order": 1, "has_booth": true},
    {"key": "silver",   "label": "Silver",   "sort_order": 2, "has_booth": true},
    {"key": "bronze",   "label": "Bronze",   "sort_order": 3, "has_booth": false},
    {"key": "community","label": "Community", "sort_order": 4, "has_booth": false}
  ]'::jsonb;

-- 2. Backfill all existing events with the default config
UPDATE events
SET sponsor_tiers = '[
  {"key": "platinum", "label": "Platinum", "sort_order": 0, "has_booth": true},
  {"key": "gold",     "label": "Gold",     "sort_order": 1, "has_booth": true},
  {"key": "silver",   "label": "Silver",   "sort_order": 2, "has_booth": true},
  {"key": "bronze",   "label": "Bronze",   "sort_order": 3, "has_booth": false},
  {"key": "community","label": "Community", "sort_order": 4, "has_booth": false}
]'::jsonb
WHERE sponsor_tiers IS NULL;

-- 3. Change sponsors.tier from ENUM to TEXT
ALTER TABLE sponsors
  ALTER COLUMN tier TYPE TEXT;

-- 4. Drop the sponsor_tier ENUM type
DROP TYPE IF EXISTS sponsor_tier;
