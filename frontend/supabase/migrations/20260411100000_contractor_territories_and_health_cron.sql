-- Insert 20 Metro Detroit contractor lead territories
-- These match the SEO pages at /contractors/:slug

INSERT INTO contractor_lead_sites (trade, city, state, slug, active)
VALUES
  ('HVAC', 'Detroit', 'MI', 'hvac-detroit', true),
  ('HVAC', 'Warren', 'MI', 'hvac-warren', true),
  ('HVAC', 'Sterling Heights', 'MI', 'hvac-sterling-heights', true),
  ('HVAC', 'Dearborn', 'MI', 'hvac-dearborn', true),
  ('HVAC', 'Livonia', 'MI', 'hvac-livonia', true),
  ('Plumbing', 'Detroit', 'MI', 'plumbing-detroit', true),
  ('Plumbing', 'Sterling Heights', 'MI', 'plumbing-sterling-heights', true),
  ('Plumbing', 'Dearborn', 'MI', 'plumbing-dearborn', true),
  ('Plumbing', 'Troy', 'MI', 'plumbing-troy', true),
  ('Plumbing', 'Livonia', 'MI', 'plumbing-livonia', true),
  ('Electrical', 'Detroit', 'MI', 'electrician-detroit', true),
  ('Electrical', 'Dearborn', 'MI', 'electrician-dearborn', true),
  ('Electrical', 'Warren', 'MI', 'electrician-warren', true),
  ('Electrical', 'Troy', 'MI', 'electrician-troy', true),
  ('Electrical', 'Livonia', 'MI', 'electrician-livonia', true),
  ('Roofing', 'Detroit', 'MI', 'roofing-detroit', true),
  ('Roofing', 'Warren', 'MI', 'roofing-warren', true),
  ('Roofing', 'Troy', 'MI', 'roofing-troy', true),
  ('Roofing', 'Southfield', 'MI', 'roofing-southfield', true),
  ('Roofing', 'Livonia', 'MI', 'roofing-livonia', true)
ON CONFLICT (slug) DO NOTHING;

-- Schedule health monitor to run every 30 minutes
SELECT cron.schedule(
  'contractor-lead-health-monitor',
  '*/30 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/contractor-lead-health-monitor',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );$$
);
