-- Lock down 8 tables flagged by security scan: drop public-targeted policies and replace with service_role-only.
-- Preserves existing admin policies on blind_teaser_dispatches and dwa_contractor_referrals.

-- 1. blind_teaser_dispatches
DROP POLICY IF EXISTS "Service role full access teaser dispatches" ON public.blind_teaser_dispatches;
CREATE POLICY "Service role full access teaser dispatches"
  ON public.blind_teaser_dispatches FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. dwa_contractor_referrals
DROP POLICY IF EXISTS "Service role full access on dwa_contractor_referrals" ON public.dwa_contractor_referrals;
CREATE POLICY "Service role full access on dwa_contractor_referrals"
  ON public.dwa_contractor_referrals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. dead_lead_charges
DROP POLICY IF EXISTS "Service role full access on dead_lead_charges" ON public.dead_lead_charges;
CREATE POLICY "Service role full access on dead_lead_charges"
  ON public.dead_lead_charges FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. signal_correlations
DROP POLICY IF EXISTS "service_role_all_corr" ON public.signal_correlations;
CREATE POLICY "service_role_all_corr"
  ON public.signal_correlations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. dead_lead_campaigns
DROP POLICY IF EXISTS "Service role full access on dead_lead_campaigns" ON public.dead_lead_campaigns;
CREATE POLICY "Service role full access on dead_lead_campaigns"
  ON public.dead_lead_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. industry_pulse_signals (paid intel — also add admin SELECT)
DROP POLICY IF EXISTS "Service role full access on industry_pulse_signals" ON public.industry_pulse_signals;
CREATE POLICY "Service role full access on industry_pulse_signals"
  ON public.industry_pulse_signals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins can read industry_pulse_signals"
  ON public.industry_pulse_signals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 7. hire_REDACTED
DROP POLICY IF EXISTS "Service role full access on hire_REDACTED" ON public.hire_REDACTED;
CREATE POLICY "Service role full access on hire_REDACTED"
  ON public.hire_REDACTED FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. marketplace_buyer_visits — drop all 3 public policies; visit tracking moves to edge function
DROP POLICY IF EXISTS "Anyone can insert marketplace_buyer_visits" ON public.marketplace_buyer_visits;
DROP POLICY IF EXISTS "Anyone can read marketplace_buyer_visits" ON public.marketplace_buyer_visits;
DROP POLICY IF EXISTS "Anyone can update marketplace_buyer_visits" ON public.marketplace_buyer_visits;
CREATE POLICY "Service role full access on marketplace_buyer_visits"
  ON public.marketplace_buyer_visits FOR ALL TO service_role USING (true) WITH CHECK (true);