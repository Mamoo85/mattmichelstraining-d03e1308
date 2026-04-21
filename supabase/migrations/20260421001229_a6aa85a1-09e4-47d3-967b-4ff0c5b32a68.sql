-- Fix 1: techalert_referrals
DROP POLICY IF EXISTS "Service role full access on techalert_referrals" ON public.techalert_referrals;

CREATE POLICY "service_role_all_techalert_referrals"
ON public.techalert_referrals
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "admin_read_techalert_referrals"
ON public.techalert_referrals
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: field_service_jobs SELECT for owning client
CREATE POLICY "clients_read_own_field_service_jobs"
ON public.field_service_jobs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR client_id::uuid IN (
    SELECT c.id FROM public.field_crm_clients c
    WHERE c.email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
  )
);