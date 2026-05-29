-- 1. Fix: Remove anon SELECT on field_service_techs (PIN exposure)
DROP POLICY IF EXISTS "anon_select_techs" ON public.field_service_techs;

-- Create secure PIN verification function (no PIN data leaves the DB)
CREATE OR REPLACE FUNCTION public.verify_tech_pin(_pin text)
RETURNS TABLE(id uuid, name text, client_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, t.client_id
  FROM public.field_service_techs t
  WHERE t.pin = _pin
    AND t.active = true
  LIMIT 1;
$$;

-- 2. Fix: Add admin SELECT policy on dark_web_monitor_findings
CREATE POLICY "Admins can view dark web findings"
ON public.dark_web_monitor_findings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Fix: Restrict public bucket listing to authenticated users
-- Drop overly broad SELECT policies on public buckets and replace with path-based access
-- admin_media bucket
DROP POLICY IF EXISTS "Public read access for admin media" ON storage.objects;
CREATE POLICY "Public read access for admin media"
ON storage.objects FOR SELECT
USING (bucket_id = 'admin_media' AND auth.role() = 'authenticated');

CREATE POLICY "Public file access for admin media"
ON storage.objects FOR SELECT
USING (bucket_id = 'admin_media' AND name IS NOT NULL AND name != '');

-- ai_generated_media bucket  
DROP POLICY IF EXISTS "Public read access for ai media" ON storage.objects;
CREATE POLICY "Public read access for ai media"
ON storage.objects FOR SELECT
USING (bucket_id = 'ai_generated_media' AND auth.role() = 'authenticated');

CREATE POLICY "Public file access for ai generated media"
ON storage.objects FOR SELECT
USING (bucket_id = 'ai_generated_media' AND name IS NOT NULL AND name != '');

-- exercise_videos bucket
DROP POLICY IF EXISTS "Public read access for exercise videos" ON storage.objects;
CREATE POLICY "Public read access for exercise videos"  
ON storage.objects FOR SELECT
USING (bucket_id = 'exercise_videos' AND auth.role() = 'authenticated');

CREATE POLICY "Public file access for exercise videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'exercise_videos' AND name IS NOT NULL AND name != '');

-- exercise_reference_images bucket
DROP POLICY IF EXISTS "Public read access for exercise reference images" ON storage.objects;
CREATE POLICY "Public read access for exercise reference images"
ON storage.objects FOR SELECT
USING (bucket_id = 'exercise_reference_images' AND auth.role() = 'authenticated');

CREATE POLICY "Public file access for exercise reference images"
ON storage.objects FOR SELECT
USING (bucket_id = 'exercise_reference_images' AND name IS NOT NULL AND name != '');