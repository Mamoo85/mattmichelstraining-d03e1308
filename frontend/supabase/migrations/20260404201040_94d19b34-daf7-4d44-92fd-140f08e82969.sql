
-- Fix: Drop all public-role "Service role full access" policies and recreate as service_role
-- This prevents unauthenticated access to client tables containing PII

-- abandoned_cart_clients
DROP POLICY IF EXISTS "Service role full access" ON public.abandoned_cart_clients;
CREATE POLICY "Service role full access" ON public.abandoned_cart_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ag_price_alert_clients
DROP POLICY IF EXISTS "Service role full access" ON public.ag_price_alert_clients;
CREATE POLICY "Service role full access" ON public.ag_price_alert_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- agent_heartbeats
DROP POLICY IF EXISTS "Service role full access on agent_heartbeats" ON public.agent_heartbeats;
CREATE POLICY "Service role full access on agent_heartbeats" ON public.agent_heartbeats FOR ALL TO service_role USING (true) WITH CHECK (true);

-- annual_review_clients
DROP POLICY IF EXISTS "Service role full access" ON public.annual_review_clients;
CREATE POLICY "Service role full access" ON public.annual_review_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- citation_monitor_clients
DROP POLICY IF EXISTS "Service role full access" ON public.citation_monitor_clients;
CREATE POLICY "Service role full access" ON public.citation_monitor_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- client_report_clients
DROP POLICY IF EXISTS "Service role full access" ON public.client_report_clients;
CREATE POLICY "Service role full access" ON public.client_report_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- fitness_report_clients
DROP POLICY IF EXISTS "Service role full access" ON public.fitness_report_clients;
CREATE POLICY "Service role full access" ON public.fitness_report_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- franchise_analyzer_clients
DROP POLICY IF EXISTS "Service role full access" ON public.franchise_analyzer_clients;
CREATE POLICY "Service role full access" ON public.franchise_analyzer_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- gov_meeting_tracker_clients
DROP POLICY IF EXISTS "Service role full access" ON public.gov_meeting_tracker_clients;
CREATE POLICY "Service role full access" ON public.gov_meeting_tracker_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- grant_discovery_clients
DROP POLICY IF EXISTS "Service role full access" ON public.grant_discovery_clients;
CREATE POLICY "Service role full access" ON public.grant_discovery_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- hoa_secretary_clients
DROP POLICY IF EXISTS "Service role full access" ON public.hoa_secretary_clients;
CREATE POLICY "Service role full access" ON public.hoa_secretary_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- hoa_violation_clients
DROP POLICY IF EXISTS "Service role full access" ON public.hoa_violation_clients;
CREATE POLICY "Service role full access" ON public.hoa_violation_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- insurance_drip_clients
DROP POLICY IF EXISTS "Service role full access" ON public.insurance_drip_clients;
CREATE POLICY "Service role full access" ON public.insurance_drip_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- landlord_letter_clients
DROP POLICY IF EXISTS "Service role full access" ON public.landlord_letter_clients;
CREATE POLICY "Service role full access" ON public.landlord_letter_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- linkedin_outreach_clients
DROP POLICY IF EXISTS "Service role full access" ON public.linkedin_outreach_clients;
CREATE POLICY "Service role full access" ON public.linkedin_outreach_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- matt_jokes (fix both policies)
DROP POLICY IF EXISTS "Anyone can view jokes" ON public.matt_jokes;
DROP POLICY IF EXISTS "Service role manages jokes" ON public.matt_jokes;
CREATE POLICY "Anyone can view jokes" ON public.matt_jokes FOR SELECT USING (true);
CREATE POLICY "Service role manages jokes" ON public.matt_jokes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- menu_engineering_clients
DROP POLICY IF EXISTS "Service role full access" ON public.menu_engineering_clients;
CREATE POLICY "Service role full access" ON public.menu_engineering_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- new_mover_clients
DROP POLICY IF EXISTS "Service role full access" ON public.new_mover_clients;
CREATE POLICY "Service role full access" ON public.new_mover_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- obituary_clients
DROP POLICY IF EXISTS "Service role full access" ON public.obituary_clients;
CREATE POLICY "Service role full access" ON public.obituary_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- podcast_pitch_clients
DROP POLICY IF EXISTS "Service role full access" ON public.podcast_pitch_clients;
CREATE POLICY "Service role full access" ON public.podcast_pitch_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- price_intelligence_clients
DROP POLICY IF EXISTS "Service role full access" ON public.price_intelligence_clients;
CREATE POLICY "Service role full access" ON public.price_intelligence_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- restaurant_menu_clients
DROP POLICY IF EXISTS "Service role full access" ON public.restaurant_menu_clients;
CREATE POLICY "Service role full access" ON public.restaurant_menu_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- rfp_alert_clients
DROP POLICY IF EXISTS "Service role full access" ON public.rfp_alert_clients;
CREATE POLICY "Service role full access" ON public.rfp_alert_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- sermon_prep_clients
DROP POLICY IF EXISTS "Service role full access" ON public.sermon_prep_clients;
CREATE POLICY "Service role full access" ON public.sermon_prep_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- str_reputation_clients
DROP POLICY IF EXISTS "Service role full access" ON public.str_reputation_clients;
CREATE POLICY "Service role full access" ON public.str_reputation_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- testimonial_harvester_clients
DROP POLICY IF EXISTS "Service role full access" ON public.testimonial_harvester_clients;
CREATE POLICY "Service role full access" ON public.testimonial_harvester_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- trade_show_clients
DROP POLICY IF EXISTS "Service role full access" ON public.trade_show_clients;
CREATE POLICY "Service role full access" ON public.trade_show_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- trade_show_followup_clients
DROP POLICY IF EXISTS "Service role full access" ON public.trade_show_followup_clients;
CREATE POLICY "Service role full access" ON public.trade_show_followup_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
