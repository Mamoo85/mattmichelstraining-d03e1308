
-- Fix b2b_referral_partners: drop public-role policy, recreate for service_role
DROP POLICY IF EXISTS "service_role_full_access_b2b_partners" ON public.b2b_referral_partners;
CREATE POLICY "service_role_full_access_b2b_partners"
  ON public.b2b_referral_partners FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Fix session_referral_rewards: drop public-role policy, recreate for service_role
DROP POLICY IF EXISTS "service_role_full_access_session_referrals" ON public.session_referral_rewards;
CREATE POLICY "service_role_full_access_session_referrals"
  ON public.session_referral_rewards FOR ALL TO service_role USING (true) WITH CHECK (true);
