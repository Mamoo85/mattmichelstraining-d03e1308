-- Fix 1: Remove anon/authenticated SELECT policies on generated_sites
-- Public access should go through generated_sites_public view which excludes phone/email
DROP POLICY IF EXISTS "Anon can view published sites without PII" ON public.generated_sites;
DROP POLICY IF EXISTS "Auth can view published sites without PII" ON public.generated_sites;

-- Fix 2: Add admin SELECT policy on sms_consent_log for audit access
CREATE POLICY "Admins can read sms consent logs"
  ON public.sms_consent_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));