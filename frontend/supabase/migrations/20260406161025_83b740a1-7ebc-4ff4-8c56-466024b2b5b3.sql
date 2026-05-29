-- Harden profiles INSERT policy to prevent privilege escalation
-- Users cannot set elevated subscription_tier, is_pro, is_vip, or stripe_customer_id on insert
DROP POLICY "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND subscription_tier = 'free'
  AND is_pro = false
  AND is_vip = false
  AND is_in_person = false
  AND stripe_customer_id IS NULL
  AND free_program_redeemed = false
);