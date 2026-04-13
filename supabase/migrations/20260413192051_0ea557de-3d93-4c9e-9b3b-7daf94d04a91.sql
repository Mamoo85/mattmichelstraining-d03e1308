-- Drop the overly permissive public ALL policy
DROP POLICY IF EXISTS "Service role full access on contractor_lead_purchases" ON public.contractor_lead_purchases;

-- Proper service_role-only write access
CREATE POLICY "service_role_all_purchases" ON public.contractor_lead_purchases
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Admin read-only access
CREATE POLICY "admin_select_purchases" ON public.contractor_lead_purchases
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));