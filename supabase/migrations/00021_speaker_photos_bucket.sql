-- Create speaker-photos storage bucket with public read access
INSERT INTO storage.buckets (id, name, public)
VALUES ('speaker-photos', 'speaker-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view speaker photos (public bucket)
CREATE POLICY "speaker_photos_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'speaker-photos');

-- Allow authenticated users to upload speaker photos
CREATE POLICY "speaker_photos_authenticated_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'speaker-photos');

-- Allow authenticated users to overwrite their uploads (upsert)
CREATE POLICY "speaker_photos_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'speaker-photos');

-- Allow authenticated users to delete speaker photos
CREATE POLICY "speaker_photos_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'speaker-photos');
