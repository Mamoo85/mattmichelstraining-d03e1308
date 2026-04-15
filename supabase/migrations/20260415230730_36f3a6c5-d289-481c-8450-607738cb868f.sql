-- Fix 1: system_comms_log — restrict from public to service_role + admin read
DROP POLICY IF EXISTS "service_role_all" ON public.system_comms_log;

CREATE POLICY "service_role_full_access" ON public.system_comms_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_read_comms_log" ON public.system_comms_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix 2: job-photos — restrict upload to verified field service techs
DROP POLICY IF EXISTS "authenticated_upload_job_photos" ON storage.objects;

CREATE POLICY "tech_upload_job_photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'job-photos'
    AND EXISTS (
      SELECT 1 FROM public.field_service_techs t
      WHERE t.id = auth.uid() AND t.active = true
    )
  );
