-- Create event-logos storage bucket with public read access
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-logos', 'event-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view event logos (public bucket)
CREATE POLICY "event_logos_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'event-logos');

-- Allow authenticated users to upload event logos
CREATE POLICY "event_logos_authenticated_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-logos');

-- Allow authenticated users to overwrite their uploads (upsert)
CREATE POLICY "event_logos_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event-logos');

-- Allow authenticated users to delete event logos
CREATE POLICY "event_logos_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'event-logos');
