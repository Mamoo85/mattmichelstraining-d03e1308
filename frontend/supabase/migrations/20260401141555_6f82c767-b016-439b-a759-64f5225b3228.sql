
-- 1. Fix business_listings: create a public view without sensitive columns
-- Drop the overly permissive "Anyone can view active listings" policy
DROP POLICY IF EXISTS "Anyone can view active listings" ON public.business_listings;

-- Add a restricted policy: only authenticated users can see active listings
CREATE POLICY "Authenticated users can view active listings"
  ON public.business_listings FOR SELECT TO authenticated
  USING (is_active = true);

-- Create a public view that excludes email and phone for unauthenticated access
CREATE OR REPLACE VIEW public.business_listings_public AS
SELECT id, business_name, owner_name, industry, city, state, website, description, logo_url, tier, is_featured, is_active
FROM public.business_listings
WHERE is_active = true;

-- 2. Fix email_unsubscribe_tokens: restrict policies to service_role only
DROP POLICY IF EXISTS "Service role can insert tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can mark tokens as used" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can read tokens" ON public.email_unsubscribe_tokens;

CREATE POLICY "Service role can insert tokens"
  ON public.email_unsubscribe_tokens FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can mark tokens as used"
  ON public.email_unsubscribe_tokens FOR UPDATE TO service_role
  USING (true);

CREATE POLICY "Service role can read tokens"
  ON public.email_unsubscribe_tokens FOR SELECT TO service_role
  USING (true);

-- 3. Fix suppressed_emails: restrict policies to service_role only
DROP POLICY IF EXISTS "Service role can insert suppressed emails" ON public.suppressed_emails;
DROP POLICY IF EXISTS "Service role can read suppressed emails" ON public.suppressed_emails;

CREATE POLICY "Service role can insert suppressed emails"
  ON public.suppressed_emails FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can read suppressed emails"
  ON public.suppressed_emails FOR SELECT TO service_role
  USING (true);
