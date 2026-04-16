-- Seed contractor_lead_sites for all landing page territories
-- 6 trade/city combinations shown on the ContractorLeads landing page
INSERT INTO public.contractor_lead_sites (trade, city, state, slug, active)
VALUES
  ('Roofing', 'Grosse Pointe', 'MI', 'roofing-grosse-pointe', true),
  ('HVAC', 'Grosse Pointe', 'MI', 'hvac-grosse-pointe', true),
  ('Plumbing', 'Grosse Pointe', 'MI', 'plumbing-grosse-pointe', true),
  ('Electrical', 'Grosse Pointe', 'MI', 'electrical-grosse-pointe', true),
  ('Gutters', 'Grosse Pointe', 'MI', 'gutters-grosse-pointe', true),
  ('Siding', 'Grosse Pointe', 'MI', 'siding-grosse-pointe', true)
ON CONFLICT (slug) DO NOTHING;