INSERT INTO public.contractor_lead_sites (slug, trade, city, state, active) VALUES
  ('electrician-livonia', 'Electrical', 'Livonia', 'MI', true),
  ('hvac-livonia', 'HVAC', 'Livonia', 'MI', true),
  ('plumbing-livonia', 'Plumbing', 'Livonia', 'MI', true),
  ('roofing-livonia', 'Roofing', 'Livonia', 'MI', true),
  ('hvac-warren', 'HVAC', 'Warren', 'MI', true),
  ('hvac-sterling-heights', 'HVAC', 'Sterling Heights', 'MI', true),
  ('hvac-dearborn', 'HVAC', 'Dearborn', 'MI', true),
  ('plumbing-sterling-heights', 'Plumbing', 'Sterling Heights', 'MI', true),
  ('plumbing-dearborn', 'Plumbing', 'Dearborn', 'MI', true),
  ('plumbing-troy', 'Plumbing', 'Troy', 'MI', true),
  ('electrician-dearborn', 'Electrical', 'Dearborn', 'MI', true),
  ('electrician-warren', 'Electrical', 'Warren', 'MI', true),
  ('electrician-troy', 'Electrical', 'Troy', 'MI', true),
  ('roofing-warren', 'Roofing', 'Warren', 'MI', true),
  ('roofing-troy', 'Roofing', 'Troy', 'MI', true),
  ('roofing-southfield', 'Roofing', 'Southfield', 'MI', true)
ON CONFLICT (slug) DO NOTHING;