-- Normalize trade values to canonical set across contractor_outreach_prospects
-- and prospector_targets. Fixes records stored with search query terms
-- ("gutter installation", "roofer", "HVAC contractor") instead of canonical
-- names ("Gutters", "Roofing", "HVAC") that match the admin panel selectors.

-- ── contractor_outreach_prospects ──────────────────────────────────────────
UPDATE public.contractor_outreach_prospects SET trade = 'Roofing'
  WHERE lower(trade) IN ('roofer','roofing contractor','roof repair','roof replacement','licensed roofer','roofing');

UPDATE public.contractor_outreach_prospects SET trade = 'HVAC'
  WHERE lower(trade) IN ('hvac contractor','heating and cooling','ac repair','furnace repair','air conditioning repair','air conditioning');

UPDATE public.contractor_outreach_prospects SET trade = 'Plumbing'
  WHERE lower(trade) IN ('plumber','plumbing','plumbing service','drain cleaning','licensed plumber','emergency plumber');

UPDATE public.contractor_outreach_prospects SET trade = 'Electrical'
  WHERE lower(trade) IN ('electrician','electrical contractor','licensed electrician','residential electrician','electrical repair','electrical');

UPDATE public.contractor_outreach_prospects SET trade = 'General Contractor'
  WHERE lower(trade) IN ('general contractor','home remodeling contractor','renovation contractor','remodeling contractor');

UPDATE public.contractor_outreach_prospects SET trade = 'Siding'
  WHERE lower(trade) IN ('siding contractor','vinyl siding','siding installation','siding repair','siding');

UPDATE public.contractor_outreach_prospects SET trade = 'Solar'
  WHERE lower(trade) IN ('solar installer','solar panel installation','solar energy contractor','solar energy','solar');

UPDATE public.contractor_outreach_prospects SET trade = 'Gutters'
  WHERE lower(trade) IN ('gutter installation','gutter cleaning','seamless gutters','gutter contractor','gutter repair','gutter','gutters');

UPDATE public.contractor_outreach_prospects SET trade = 'Boiler'
  WHERE lower(trade) IN ('boiler','boiler repair','boiler installation','boiler contractor');

UPDATE public.contractor_outreach_prospects SET trade = 'Painting'
  WHERE lower(trade) IN ('painter','painting contractor','interior painting','exterior painting','painting');

UPDATE public.contractor_outreach_prospects SET trade = 'Landscaping'
  WHERE lower(trade) IN ('landscaper','lawn care','lawn service','tree service','snow removal','landscaping');

-- ── prospector_targets ──────────────────────────────────────────────────────
UPDATE public.prospector_targets SET trade = 'Roofing'
  WHERE lower(trade) IN ('roofer','roofing contractor','roof repair','roof replacement','licensed roofer','roofing');

UPDATE public.prospector_targets SET trade = 'HVAC'
  WHERE lower(trade) IN ('hvac contractor','heating and cooling','ac repair','furnace repair','air conditioning repair','air conditioning');

UPDATE public.prospector_targets SET trade = 'Plumbing'
  WHERE lower(trade) IN ('plumber','plumbing','plumbing service','drain cleaning','licensed plumber');

UPDATE public.prospector_targets SET trade = 'Electrical'
  WHERE lower(trade) IN ('electrician','electrical contractor','licensed electrician','residential electrician','electrical');

UPDATE public.prospector_targets SET trade = 'General Contractor'
  WHERE lower(trade) IN ('general contractor','home remodeling contractor','renovation contractor');

UPDATE public.prospector_targets SET trade = 'Siding'
  WHERE lower(trade) IN ('siding contractor','vinyl siding','siding installation','siding repair','siding');

UPDATE public.prospector_targets SET trade = 'Solar'
  WHERE lower(trade) IN ('solar installer','solar panel installation','solar energy contractor','solar energy','solar');

UPDATE public.prospector_targets SET trade = 'Gutters'
  WHERE lower(trade) IN ('gutter installation','gutter cleaning','seamless gutters','gutter contractor','gutter');
