-- Add per-event schedule message (shown on My Schedule tab, supports markdown)
ALTER TABLE events ADD COLUMN schedule_message TEXT;
