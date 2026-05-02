-- Saved discovery recipes (named target searches with optional cron schedule)
CREATE TABLE IF NOT EXISTS public.outreach_target_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  schedule_cron text,
  last_run_at timestamptz,
  last_run_stats jsonb DEFAULT '{}'::jsonb,
  total_discovered integer NOT NULL DEFAULT 0,
  total_inserted integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.outreach_target_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access target recipes"
  ON public.outreach_target_recipes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins manage target recipes"
  ON public.outreach_target_recipes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_target_recipes_active ON public.outreach_target_recipes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_target_recipes_schedule ON public.outreach_target_recipes(schedule_cron) WHERE schedule_cron IS NOT NULL;

-- Generic data-source cache (one row per source+key tuple)
CREATE TABLE IF NOT EXISTS public.data_source_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL,
  cache_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_count integer NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  fetch_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, cache_key)
);

ALTER TABLE public.data_source_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access data source cache"
  ON public.data_source_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins read data source cache"
  ON public.data_source_cache FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_data_source_cache_lookup ON public.data_source_cache(source_id, cache_key);
CREATE INDEX IF NOT EXISTS idx_data_source_cache_expiry ON public.data_source_cache(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_data_source_cache_source ON public.data_source_cache(source_id, fetched_at DESC);

-- Discovery run audit log
CREATE TABLE IF NOT EXISTS public.discovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid REFERENCES public.outreach_target_recipes(id) ON DELETE SET NULL,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'running',
  discovered integer NOT NULL DEFAULT 0,
  enriched integer NOT NULL DEFAULT 0,
  inserted integer NOT NULL DEFAULT 0,
  skipped_dupe integer NOT NULL DEFAULT 0,
  skipped_compliance integer NOT NULL DEFAULT 0,
  skipped_low_confidence integer NOT NULL DEFAULT 0,
  cost_cents integer NOT NULL DEFAULT 0,
  provider_breakdown jsonb DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.discovery_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access discovery runs"
  ON public.discovery_runs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins read discovery runs"
  ON public.discovery_runs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_discovery_runs_recipe ON public.discovery_runs(recipe_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_runs_status ON public.discovery_runs(status, started_at DESC);

-- Augment outreach_targets with discovery metadata
ALTER TABLE public.outreach_targets
  ADD COLUMN IF NOT EXISTS confidence_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discovery_run_id uuid REFERENCES public.discovery_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cross_licensed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS license_state text,
  ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_outreach_targets_dedup ON public.outreach_targets(lower(business_name), zip);
CREATE INDEX IF NOT EXISTS idx_outreach_targets_vertical_state ON public.outreach_targets(vertical, state);
CREATE INDEX IF NOT EXISTS idx_outreach_targets_enrich_backfill
  ON public.outreach_targets(last_enriched_at NULLS FIRST)
  WHERE email IS NULL OR fax IS NULL;

-- updated_at trigger for recipes
CREATE OR REPLACE FUNCTION public.touch_outreach_target_recipes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_target_recipes_updated_at ON public.outreach_target_recipes;
CREATE TRIGGER trg_target_recipes_updated_at
  BEFORE UPDATE ON public.outreach_target_recipes
  FOR EACH ROW EXECUTE FUNCTION public.touch_outreach_target_recipes_updated_at();