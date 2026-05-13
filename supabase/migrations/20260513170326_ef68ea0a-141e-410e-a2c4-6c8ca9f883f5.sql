-- Drop email-claim based RLS policies that allow auth bypass via spoofed JWT email

DROP POLICY IF EXISTS "users see own pitches" ON public.addon_pitches;
-- service_role bypass + admin (via has_role) remains; client access goes through edge functions

DROP POLICY IF EXISTS buyer_read_purchased_lead_audit ON public.lead_enrichment_audit;
-- admin_read_lea + service_role_all_lea remain; buyers access via edge function with session token

DROP POLICY IF EXISTS admin_select_own ON public.admin_command_log;
CREATE POLICY admin_select_all ON public.admin_command_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS clients_read_own_field_service_jobs ON public.field_service_jobs;
-- Access for field_crm_clients (magic-link tokens) goes through service-role edge functions only
