CREATE TABLE IF NOT EXISTS public.demand_radar_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  primary_domain TEXT,
  physical_address TEXT,
  sector TEXT NOT NULL CHECK (sector IN ('hvac','plumbing','electrical','roofing')),
  place_id TEXT NOT NULL UNIQUE,
  rating_count INTEGER DEFAULT 0,
  enrichment_status TEXT NOT NULL DEFAULT 'pending',
  enrichment_completed_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demand_radar_targets_sector ON public.demand_radar_targets(sector);
CREATE INDEX IF NOT EXISTS idx_demand_radar_targets_status ON public.demand_radar_targets(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_demand_radar_targets_discovered ON public.demand_radar_targets(discovered_at DESC);

ALTER TABLE public.demand_radar_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_demand_radar_targets"
  ON public.demand_radar_targets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
