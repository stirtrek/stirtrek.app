-- Add photo_override column to speakers table
-- Stores a Supabase Storage public URL for uploaded speaker photos.
-- Takes priority over profile_picture (Sessionize URL) when displaying.
ALTER TABLE speakers ADD COLUMN photo_override TEXT;
