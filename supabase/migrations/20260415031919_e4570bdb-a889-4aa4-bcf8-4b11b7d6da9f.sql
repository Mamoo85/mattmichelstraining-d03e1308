-- AUDIT 1: Tighten anonymous INSERT policies

-- 1. newsletter_subscribers — add email format check
DROP POLICY IF EXISTS "Anon can insert newsletter subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Anon can insert newsletter subscribers"
  ON public.newsletter_subscribers FOR INSERT TO anon
  WITH CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- 2. site_scanner_leads — email length only
DROP POLICY IF EXISTS "anon_insert" ON public.site_scanner_leads;
CREATE POLICY "anon_insert_validated"
  ON public.site_scanner_leads FOR INSERT TO anon
  WITH CHECK (char_length(coalesce(email, '')) <= 255);

-- 3. exit_intent_leads — email length only
DROP POLICY IF EXISTS "anon_insert" ON public.exit_intent_leads;
CREATE POLICY "anon_insert_validated"
  ON public.exit_intent_leads FOR INSERT TO anon
  WITH CHECK (char_length(coalesce(email, '')) <= 255);

-- 4. capture_submissions — email length validation
DROP POLICY IF EXISTS "Capture submissions: anon can insert" ON public.capture_submissions;
CREATE POLICY "capture_submissions_anon_insert_validated"
  ON public.capture_submissions FOR INSERT TO anon
  WITH CHECK (char_length(coalesce(email, '')) <= 255);

-- 5. storage.objects — remove anonymous upload, restrict to authenticated
DROP POLICY IF EXISTS "anon_upload_job_photos" ON storage.objects;
CREATE POLICY "authenticated_upload_job_photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-photos');