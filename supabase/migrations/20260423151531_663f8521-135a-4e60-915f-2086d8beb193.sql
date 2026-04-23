-- Normalize trade values to lowercase canonical slugs so admin generator + landing page agree.
UPDATE public.contractor_lead_sites SET trade = 'electrical' WHERE trade = 'Electrical';
UPDATE public.contractor_lead_sites SET trade = 'hvac'       WHERE trade = 'HVAC';
UPDATE public.contractor_lead_sites SET trade = 'plumbing'   WHERE trade = 'Plumbing';
UPDATE public.contractor_lead_sites SET trade = 'roofing'    WHERE trade = 'Roofing';
UPDATE public.contractor_lead_sites SET trade = 'gutters'    WHERE trade = 'Gutters';
UPDATE public.contractor_lead_sites SET trade = 'siding'     WHERE trade = 'Siding';
