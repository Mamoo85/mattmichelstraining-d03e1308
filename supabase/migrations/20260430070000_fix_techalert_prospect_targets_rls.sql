-- Fix: techalert_prospect_targets had USING(false) blocking all admin UI reads.
-- Drops the broken deny-all policy and replaces with proper service_role + admin access.

DROP POLICY IF EXISTS "service_role_all_techalert_prospect_targets" ON public.techalert_prospect_targets;

CREATE POLICY "service_role_all_techalert_prospect_targets"
  ON public.techalert_prospect_targets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admin_all_techalert_prospect_targets"
  ON public.techalert_prospect_targets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
