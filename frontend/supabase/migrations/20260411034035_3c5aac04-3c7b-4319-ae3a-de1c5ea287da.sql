
-- field_crm_clients: remove JWT-claim policies (has_role ALL policy already exists)
DROP POLICY IF EXISTS "Admin select field_crm_clients" ON public.field_crm_clients;
DROP POLICY IF EXISTS "Admin insert field_crm_clients" ON public.field_crm_clients;
DROP POLICY IF EXISTS "Admin update field_crm_clients" ON public.field_crm_clients;

-- crm_visitor_events
DROP POLICY IF EXISTS "Admin select crm_visitor_events" ON public.crm_visitor_events;

-- tech_locations
DROP POLICY IF EXISTS "Admin select tech_locations" ON public.tech_locations;

-- review_blast_log
DROP POLICY IF EXISTS "Admin select review_blast_log" ON public.review_blast_log;

-- competitor_review_alerts
DROP POLICY IF EXISTS "Admin select competitor_review_alerts" ON public.competitor_review_alerts;

-- lead_activities: remove JWT-claim ALL policy, add has_role ALL policy for write access
DROP POLICY IF EXISTS "Admin all lead_activities" ON public.lead_activities;

CREATE POLICY "Admin full access to lead_activities"
ON public.lead_activities
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
