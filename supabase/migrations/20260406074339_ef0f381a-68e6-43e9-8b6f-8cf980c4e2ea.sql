-- Fix contractor_leads: remove redundant SELECT policy, add service_role INSERT policy
-- Currently only admin can SELECT/ALL, but no explicit restriction on authenticated INSERT
-- Leads are inserted by edge functions (service_role), so restrict INSERT to service_role

DROP POLICY IF EXISTS "admin_select_leads" ON public.contractor_leads;

-- Add explicit service_role INSERT policy (the admin_all_leads ALL policy already covers admin)
CREATE POLICY "service_role_insert_leads" ON public.contractor_leads
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Add anon INSERT for public lead capture forms (chatbot-widget, contractor-lead-capture)
CREATE POLICY "anon_insert_leads" ON public.contractor_leads
  FOR INSERT TO anon
  WITH CHECK (true);