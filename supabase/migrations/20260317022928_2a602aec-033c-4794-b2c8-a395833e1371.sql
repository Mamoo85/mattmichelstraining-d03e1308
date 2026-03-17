
-- Create the form_checks bucket (25MB limit, restricted MIME types)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('form_checks', 'form_checks', true, 26214400, ARRAY['video/mp4', 'video/quicktime', 'video/webm'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/webm'];

-- RLS: Users can upload to their own folder
CREATE POLICY "Users upload own form checks" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'form_checks' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can read their own videos
CREATE POLICY "Users read own form checks" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'form_checks' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Admins can read all form checks
CREATE POLICY "Admins read all form checks" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'form_checks' AND has_role(auth.uid(), 'admin'::app_role));

-- RLS: Allow cleanup function to delete old videos
CREATE POLICY "Service role can delete form checks" ON storage.objects
  FOR DELETE TO service_role
  USING (bucket_id = 'form_checks');

-- Enable pg_cron and pg_net for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
