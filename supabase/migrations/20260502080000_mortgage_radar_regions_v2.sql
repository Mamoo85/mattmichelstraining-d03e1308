-- Mortgage Radar: region-level coverage for Michigan LOs.
-- LOs pick markets (Southeast Michigan, West Michigan, etc.) — not counties or zips.
-- Backward compat: coverage_counties + zip_codes still work as fallbacks.

ALTER TABLE public.mortgage_radar_clients
  ADD COLUMN IF NOT EXISTS coverage_regions text[] DEFAULT '{}';

ALTER TABLE public.mortgage_radar_leads
  ADD COLUMN IF NOT EXISTS region text;

CREATE INDEX IF NOT EXISTS idx_mortgage_radar_leads_region
  ON public.mortgage_radar_leads (region, created_at DESC);

-- Update Matt's test client to full Southeast Michigan region
UPDATE public.mortgage_radar_clients
SET
  coverage_regions = ARRAY['Southeast Michigan'],
  coverage_counties = ARRAY[]::text[]   -- region supersedes county list
WHERE email = 'matt@detroitwebagent.com';
