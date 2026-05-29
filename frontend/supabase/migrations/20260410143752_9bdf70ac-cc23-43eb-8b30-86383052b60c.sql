
-- Fix field_crm_clients policies
DROP POLICY IF EXISTS "Admin full access to field_crm_clients" ON public.field_crm_clients;
CREATE POLICY "Admin full access to field_crm_clients"
  ON public.field_crm_clients
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix crm_visitor_events policies
DROP POLICY IF EXISTS "Admin read crm_visitor_events" ON public.crm_visitor_events;
CREATE POLICY "Admin read crm_visitor_events"
  ON public.crm_visitor_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix tech_locations policies
DROP POLICY IF EXISTS "Admin read tech_locations" ON public.tech_locations;
CREATE POLICY "Admin read tech_locations"
  ON public.tech_locations
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix review_blast_log policies
DROP POLICY IF EXISTS "Admin read review_blast_log" ON public.review_blast_log;
CREATE POLICY "Admin read review_blast_log"
  ON public.review_blast_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix competitor_review_alerts policies
DROP POLICY IF EXISTS "Admin read competitor_review_alerts" ON public.competitor_review_alerts;
CREATE POLICY "Admin read competitor_review_alerts"
  ON public.competitor_review_alerts
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix lead_activities policies
DROP POLICY IF EXISTS "Admin read lead_activities" ON public.lead_activities;
CREATE POLICY "Admin read lead_activities"
  ON public.lead_activities
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
