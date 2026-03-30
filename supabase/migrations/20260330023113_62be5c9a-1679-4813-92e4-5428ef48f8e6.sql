
-- 1. Restrict email_send_log: deny all authenticated users (only service_role can access)
CREATE POLICY "Deny authenticated read on email_send_log"
  ON public.email_send_log FOR SELECT TO authenticated
  USING (false);

-- 2. Drop broad training_programs SELECT policy; keep admin-only access
DROP POLICY IF EXISTS "Authenticated can read active programs" ON public.training_programs;

-- 3. Make form-check-videos and form_checks storage buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('form-check-videos', 'form_checks');

-- 4. Drop the overly broad form-check-videos SELECT policy
DROP POLICY IF EXISTS "Anyone can view form check videos" ON storage.objects;

-- 5. Add ownership + admin SELECT policy for form-check-videos
CREATE POLICY "Users and admins read form check videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'form-check-videos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- 6. Update form_checks SELECT policy to also allow admins
DROP POLICY IF EXISTS "Users read own form checks" ON storage.objects;
CREATE POLICY "Users and admins read form checks"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'form_checks'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );
