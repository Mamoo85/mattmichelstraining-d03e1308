-- Restrict service-role-intent policies to service_role only (not public)
DROP POLICY IF EXISTS "Service role full access on dead_lead_contacts" ON public.dead_lead_contacts;
CREATE POLICY "Service role full access on dead_lead_contacts"
  ON public.dead_lead_contacts
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on daily_text_targets" ON public.daily_text_targets;
CREATE POLICY "Service role full access on daily_text_targets"
  ON public.daily_text_targets
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
