
-- Add unique constraint on email for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS field_crm_clients_email_unique ON public.field_crm_clients (email);

-- Create job-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: admin can read all
CREATE POLICY "admin_read_job_photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'job-photos' AND public.has_role(auth.uid(), 'admin'));

-- Storage policy: anon can upload (techs use anon client)
CREATE POLICY "anon_upload_job_photos" ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'job-photos');

-- Storage policy: service_role full access
CREATE POLICY "srv_job_photos" ON storage.objects TO service_role
  USING (bucket_id = 'job-photos') WITH CHECK (bucket_id = 'job-photos');
