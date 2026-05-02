-- Mortgage Radar: county-level coverage + region-aware lead matching.
-- LOs think in markets (Wayne, Oakland, Macomb), not individual zip codes.
-- zip_codes is preserved for backward compat; county wins when set.

ALTER TABLE public.mortgage_radar_clients
  ADD COLUMN IF NOT EXISTS coverage_counties text[] DEFAULT '{}';

ALTER TABLE public.mortgage_radar_leads
  ADD COLUMN IF NOT EXISTS county text;

-- Index for county-based digest queries
CREATE INDEX IF NOT EXISTS idx_mortgage_radar_leads_county
  ON public.mortgage_radar_leads (county, created_at DESC);

-- Expand Matt's test client to full Detroit Metro
UPDATE public.mortgage_radar_clients
SET
  coverage_counties = ARRAY['Wayne', 'Oakland', 'Macomb'],
  zip_codes = ARRAY[]::text[]   -- clear old city-only zips; county coverage handles it
WHERE email = 'matt@detroitwebagent.com';
