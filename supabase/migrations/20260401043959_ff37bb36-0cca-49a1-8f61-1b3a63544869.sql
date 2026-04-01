
-- Fix 1: Drop the misconfigured policy on b2b_referral_conversions that grants public access
DROP POLICY IF EXISTS "service_role_full_access_b2b_conversions" ON public.b2b_referral_conversions;

-- Create proper service_role-only policy
CREATE POLICY "service_role_full_access_b2b_conversions"
  ON public.b2b_referral_conversions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Fix 2: Enable RLS on _applied_migrations and restrict to service_role
ALTER TABLE public._applied_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_applied_migrations"
  ON public._applied_migrations FOR ALL TO service_role USING (true) WITH CHECK (true);
