
-- Fix 1: Remove overly broad gift card lookup policy
DROP POLICY IF EXISTS "Users can lookup gift cards by code" ON public.gift_cards;

-- Fix 2: Replace newsletter subscribe policy with email ownership check
DROP POLICY IF EXISTS "Authenticated users can subscribe" ON public.newsletter_subscribers;
CREATE POLICY "Authenticated users can subscribe own email"
  ON public.newsletter_subscribers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    email = (SELECT p.email FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1)
  );

-- Also allow anon inserts for the public newsletter signup form via service role only
-- (the edge function already uses service_role for newsletter signups)
