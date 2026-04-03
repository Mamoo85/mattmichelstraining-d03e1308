
-- Fix 1: Replace overly broad public listing policy with authenticated-only
-- The public view (business_listings_public) already strips phone/email
DROP POLICY IF EXISTS "Public can view active listings" ON public.business_listings;

CREATE POLICY "Authenticated can view active listings"
  ON public.business_listings FOR SELECT TO authenticated
  USING (is_active = true);

-- Fix 2: Add admin SELECT policy for missed_call_clients
CREATE POLICY "Admins can view missed_call_clients"
  ON public.missed_call_clients FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
