-- Seed the 8 open territories advertised on /contractor-leads
-- These slugs are referenced by /leads/:slug homeowner pages
-- Without these rows the lead capture function returns 404 and drops leads

INSERT INTO contractor_lead_sites (trade, city, state, slug, monthly_fee_cents) VALUES
  ('roofing',    'Chicago',   'IL', 'roofing-chicago',    39900),
  ('hvac',       'Columbus',  'OH', 'hvac-columbus',      39900),
  ('plumbing',   'Phoenix',   'AZ', 'plumbing-phoenix',   39900),
  ('electrical', 'Dallas',    'TX', 'electrical-dallas',  39900),
  ('roofing',    'Charlotte', 'NC', 'roofing-charlotte',  29900),
  ('hvac',       'Denver',    'CO', 'hvac-denver',        29900),
  ('plumbing',   'Nashville', 'TN', 'plumbing-nashville', 29900),
  ('gutters',    'Atlanta',   'GA', 'gutters-atlanta',    29900)
ON CONFLICT (slug) DO NOTHING;
