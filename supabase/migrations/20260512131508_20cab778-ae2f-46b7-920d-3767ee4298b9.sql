
DROP POLICY IF EXISTS "service_role_all_jitter" ON public.enrichment_jitter_log;
CREATE POLICY "service_role_all_jitter" ON public.enrichment_jitter_log
  AS PERMISSIVE FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_all_techalert_prospect_targets" ON public.techalert_prospect_targets;
CREATE POLICY "service_role_all_techalert_prospect_targets" ON public.techalert_prospect_targets
  AS PERMISSIVE FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS "admins_read_techalert_prospect_targets" ON public.techalert_prospect_targets;
CREATE POLICY "admins_read_techalert_prospect_targets" ON public.techalert_prospect_targets
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "client_rw_trade_lead_actions" ON public.trade_radar_lead_actions;
DROP POLICY IF EXISTS "client_rw_mortgage_radar_lead_actions" ON public.mortgage_radar_lead_actions;
DROP POLICY IF EXISTS "client_can_view_own_lock" ON public.client_price_locks;

DROP POLICY IF EXISTS "Admin can read buyer_session_tokens" ON public.buyer_session_tokens;
CREATE POLICY "Admin can read buyer_session_tokens" ON public.buyer_session_tokens
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins_select_prospect_nudges" ON public.prospect_nudges;
DROP POLICY IF EXISTS "admins_insert_prospect_nudges" ON public.prospect_nudges;
DROP POLICY IF EXISTS "admins_update_prospect_nudges" ON public.prospect_nudges;
DROP POLICY IF EXISTS "admins_delete_prospect_nudges" ON public.prospect_nudges;
CREATE POLICY "admins_select_prospect_nudges" ON public.prospect_nudges
  AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins_insert_prospect_nudges" ON public.prospect_nudges
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins_update_prospect_nudges" ON public.prospect_nudges
  AS PERMISSIVE FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins_delete_prospect_nudges" ON public.prospect_nudges
  AS PERMISSIVE FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can log schema validation failures" ON public.schema_validation_failures;
CREATE POLICY "Anyone can log schema validation failures" ON public.schema_validation_failures
  AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (
    component IS NOT NULL AND length(component) BETWEEN 1 AND 200
    AND table_name IS NOT NULL AND length(table_name) BETWEEN 1 AND 200
  );

DROP POLICY IF EXISTS "Anyone can submit a migration request" ON public.fielddesk_migration_requests;
CREATE POLICY "Anyone can submit a migration request" ON public.fielddesk_migration_requests
  AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (
    contact_email IS NOT NULL
    AND contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND length(contact_email) <= 320
    AND org_name IS NOT NULL AND length(org_name) BETWEEN 1 AND 200
  );

DROP POLICY IF EXISTS "anon_insert_leads" ON public.contractor_leads;
CREATE POLICY "anon_insert_leads" ON public.contractor_leads
  AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (
    (
      (email IS NOT NULL AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' AND length(email) <= 320)
      OR (phone IS NOT NULL AND length(phone) BETWEEN 7 AND 32)
    )
    AND name IS NOT NULL AND length(name) BETWEEN 1 AND 200
  );
