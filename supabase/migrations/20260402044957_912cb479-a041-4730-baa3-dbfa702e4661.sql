-- 1. Drop the public-facing SELECT policies that expose phone/email
DROP POLICY IF EXISTS "Public can view published sites" ON public.generated_sites;
DROP POLICY IF EXISTS "Authenticated can view published sites" ON public.generated_sites;

-- 2. Create a safe public view without PII columns
CREATE OR REPLACE VIEW public.generated_sites_public AS
SELECT id, business_name, slug, template_key, color_scheme, sections, logo_url, address, is_published, published_at, created_at, updated_at, lead_id
FROM public.generated_sites
WHERE is_published = true;

-- 3. Re-add narrow SELECT policies that exclude PII for non-admins
CREATE POLICY "Anon can view published sites without PII"
ON public.generated_sites
FOR SELECT TO anon
USING (is_published = true);

CREATE POLICY "Auth can view published sites without PII"
ON public.generated_sites
FOR SELECT TO authenticated
USING (is_published = true);

-- 4. Enable security invoker on the view so RLS still applies
ALTER VIEW public.generated_sites_public SET (security_invoker = on);