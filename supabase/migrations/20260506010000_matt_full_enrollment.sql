-- Enroll matt@detroitwebagent.com in remaining DWA products:
-- Demand Radar (industry_pulse_clients as contractor)
-- Buyer Radar (industry_pulse_clients as supplier)
-- Dead Lead Reactivation (dead_lead_campaigns linked to Matt's HVAC contractor_client)
-- All use fixed UUIDs + ON CONFLICT DO NOTHING so safe to re-run.

-- =====================================================================
-- DEMAND RADAR — industry_pulse_clients (buyer_type='contractor')
-- Dashboard: /my-demand-radar?token=matt-test-demand-radar-0001
-- =====================================================================
INSERT INTO public.industry_pulse_clients
  (id, company_name, email, phone, contact_name,
   target_industries, target_roles, dashboard_token, active,
   buyer_type, vertical, territory_counties, is_test_account, plan)
VALUES
  ('ff000006-test-0006-0006-000000000001',
   'DWA Test — Demand Radar', 'matt@detroitwebagent.com', '+13139921219', 'Matt Michels',
   ARRAY['hvac','roofing','plumbing','electrical','construction'],
   ARRAY['hvac_tech','electrician','plumber','roofer'],
   'matt-test-demand-radar-0001',
   true,
   'contractor', 'hvac_supply',
   ARRAY['Wayne','Oakland','Macomb','Washtenaw'],
   true, 'standard')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- BUYER RADAR — industry_pulse_clients (buyer_type='supplier')
-- Dashboard: /my-buyer-radar?token=matt-test-buyer-radar-00001
-- =====================================================================
INSERT INTO public.industry_pulse_clients
  (id, company_name, email, phone, contact_name,
   target_industries, target_roles, dashboard_token, active,
   buyer_type, vertical, territory_counties, is_test_account, plan)
VALUES
  ('ff000006-test-0006-0006-000000000002',
   'DWA Test — Buyer Radar', 'matt@detroitwebagent.com', '+13139921219', 'Matt Michels',
   ARRAY['manufacturing','steel','fabrication','industrial'],
   ARRAY['procurement','operations','plant_manager'],
   'matt-test-buyer-radar-00001',
   true,
   'supplier', 'industrial_general',
   ARRAY['Wayne','Oakland','Macomb'],
   true, 'standard')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- DEAD LEAD REACTIVATION — dead_lead_campaigns
-- Linked to Matt's HVAC contractor_client (aa000001-test-0001-0001-000000000001)
-- =====================================================================
INSERT INTO public.dead_lead_campaigns
  (id, contractor_id, name, status)
VALUES
  ('gg000007-test-0007-0007-000000000001',
   'aa000001-test-0001-0001-000000000001',
   'Matt Test Reactivation — HVAC', 'active')
ON CONFLICT (id) DO NOTHING;
