-- 20260424110000_matt_test_enrollments.sql
-- Enrolls matt@detroitwebagent.com as an active test customer in the top 5 products.
-- Uses fixed UUIDs so this migration is safe to run multiple times (ON CONFLICT DO NOTHING).
-- Matt can access each product view without going through Stripe checkout.

-- =====================================================================
-- CONTRACTOR LEADS — one active row per trade type so Matt can see
-- the exact customer dashboard for every contractor persona.
-- Dashboard URL: /my-contractor-leads?token=<roi_token>
-- =====================================================================
INSERT INTO public.contractor_clients
  (id, email, business_name, trade, city, state, active, roi_token, name, created_at)
VALUES
  ('aa000001-test-0001-0001-000000000001', 'matt@detroitwebagent.com', 'DWA Test — HVAC',       'hvac',               'Detroit', 'MI', true, 'matt-test-hvac-roi-token-00000001', 'Matt Michels', now()),
  ('aa000001-test-0001-0001-000000000002', 'matt@detroitwebagent.com', 'DWA Test — Roofing',    'roofing',            'Detroit', 'MI', true, 'matt-test-roofing-roi-token-000001', 'Matt Michels', now()),
  ('aa000001-test-0001-0001-000000000003', 'matt@detroitwebagent.com', 'DWA Test — Plumbing',   'plumbing',           'Detroit', 'MI', true, 'matt-test-plumbing-roi-token-00001', 'Matt Michels', now()),
  ('aa000001-test-0001-0001-000000000004', 'matt@detroitwebagent.com', 'DWA Test — Electrical', 'electrical',         'Detroit', 'MI', true, 'matt-test-electrical-roi-token-0001', 'Matt Michels', now()),
  ('aa000001-test-0001-0001-000000000005', 'matt@detroitwebagent.com', 'DWA Test — General',    'general_contractor', 'Detroit', 'MI', true, 'matt-test-general-roi-token-000001', 'Matt Michels', now())
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- TECHALERT — hire_alert_clients
-- Dashboard URL: /my-techalert?token=<dashboard_token>
-- =====================================================================
INSERT INTO public.hire_alert_clients
  (id, company_name, owner_email, owner_phone, active, plan,
   target_roles, target_zip_codes, notify_email, notify_sms, dashboard_token)
VALUES
  ('bb000002-test-0002-0002-000000000001',
   'DWA Test Account', 'matt@detroitwebagent.com', '+13139921219',
   true, 'standalone',
   ARRAY['boiler_operator','hvac_tech','plumber','electrician','rn','lpn'],
   ARRAY['48201','48202','48205','48210','48215','48220'],
   true, true,
   'matt-test-techalert-dashboard-0001')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- FIELDDESK — field_crm_clients
-- Accessed via /field-service/dispatch (admin) + ?demo=1 tech app
-- =====================================================================
INSERT INTO public.field_crm_clients
  (id, business_name, owner_name, email, phone, industry, status, plan, monthly_price)
VALUES
  ('cc000003-test-0003-0003-000000000001',
   'DWA Test — FieldDesk', 'Matt Michels', 'matt@detroitwebagent.com',
   '+13139921219', 'hvac', 'active', 'standard', 19900)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- MISSED CALL CATCH — missed_call_clients
-- No token needed — admin views by email
-- =====================================================================
INSERT INTO public.missed_call_clients
  (id, business_name, contact_name, email, business_phone, active, response_message)
VALUES
  ('dd000004-test-0004-0004-000000000001',
   'DWA Test — Missed Call', 'Matt Michels', 'matt@detroitwebagent.com',
   '+13139921219', true,
   'Hey! Thanks for calling Detroit Web Agency — I''ll call you right back within 5 minutes.')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- MORTGAGE RADAR — mortgage_radar_clients (as founder)
-- Dashboard: /mortgage-radar (or /my-mortgage-radar when built)
-- =====================================================================
INSERT INTO public.mortgage_radar_clients
  (id, email, contact_name, business_name, nmls_number, phone,
   zip_codes, active, is_founder)
VALUES
  ('ee000005-test-0005-0005-000000000001',
   'matt@detroitwebagent.com', 'Matt Michels', 'Detroit Web Agency', 'DWA-FOUNDER',
   '+13139921219',
   ARRAY['48201','48202','48205','48210','48215','48220','48224','48228','48236'],
   true, true)
ON CONFLICT (email) DO UPDATE SET
  active = true,
  is_founder = true,
  zip_codes = ARRAY['48201','48202','48205','48210','48215','48220','48224','48228','48236'];
