
-- Fix 1: compliance_blocks — drop public ALL policy, add service_role only
DROP POLICY IF EXISTS "Allow all for compliance_blocks" ON public.compliance_blocks;
DROP POLICY IF EXISTS "compliance_blocks_public_all" ON public.compliance_blocks;
-- Drop any policy with USING(true) on this table
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'compliance_blocks'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.compliance_blocks', pol.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "service_role_full_access"
  ON public.compliance_blocks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Fix 2: email_send_state — drop public policy, add proper service_role policy
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_send_state'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.email_send_state', pol.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "service_role_full_access"
  ON public.email_send_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
