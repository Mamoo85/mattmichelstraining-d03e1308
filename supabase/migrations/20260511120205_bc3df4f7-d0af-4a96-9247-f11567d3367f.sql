ALTER TABLE public.trade_radar_clients
  ADD COLUMN IF NOT EXISTS coverage_regions text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS coverage_counties text[] DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_trade_radar_clients_coverage_regions
  ON public.trade_radar_clients USING GIN (coverage_regions);

UPDATE public.trade_radar_clients
SET coverage_regions = ARRAY['detroit','wayne','se michigan']::text[],
    coverage_counties = ARRAY['Wayne','Oakland','Macomb']::text[]
WHERE active = true
  AND (coverage_regions IS NULL OR coverage_regions = '{}'::text[]);