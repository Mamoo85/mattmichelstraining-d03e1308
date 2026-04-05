
-- 1. Add admin SELECT policy to dark_web_monitor_clients (consistent with other client tables)
CREATE POLICY "Admins can read dark_web_monitor_clients"
  ON public.dark_web_monitor_clients
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Add user SELECT policy to biomechanics_media storage bucket
CREATE POLICY "Users can read own biomechanics_media"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'biomechanics_media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
