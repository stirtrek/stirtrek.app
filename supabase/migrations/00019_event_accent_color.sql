-- Add per-tenant accent color
ALTER TABLE events ADD COLUMN accent_color TEXT DEFAULT '#FF3B3B';
