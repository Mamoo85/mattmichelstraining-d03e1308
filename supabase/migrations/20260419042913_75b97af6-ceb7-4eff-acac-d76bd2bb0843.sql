
DROP FUNCTION IF EXISTS public.consume_source_budget(text, numeric);

-- Routes
CREATE TABLE IF NOT EXISTS public.enrichment_provider_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical text NOT NULL,
  provider text NOT NULL,
  call_order int NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  min_score int DEFAULT 0,
  requires_field text,
  short_circuit_on text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vertical, provider)
);
ALTER TABLE public.enrichment_provider_routes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='enrichment_provider_routes' AND policyname='service_role_all_routes') THEN
    CREATE POLICY "service_role_all_routes" ON public.enrichment_provider_routes FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_routes_vertical_order
  ON public.enrichment_provider_routes (vertical, call_order) WHERE enabled = true;

-- Jitter
CREATE TABLE IF NOT EXISTS public.enrichment_jitter_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  jittered_at timestamptz NOT NULL,
  jitter_seconds int NOT NULL,
  proxy_pool text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.enrichment_jitter_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='enrichment_jitter_log' AND policyname='service_role_all_jitter') THEN
    CREATE POLICY "service_role_all_jitter" ON public.enrichment_jitter_log FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_jitter_source_recent
  ON public.enrichment_jitter_log (source, jittered_at DESC);

-- Add missing columns to existing budget table
ALTER TABLE public.enrichment_source_budgets
  ADD COLUMN IF NOT EXISTS cost_per_call numeric(10,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paused_until timestamptz;

-- D33: Atomic budget consumption (uses existing column names)
CREATE OR REPLACE FUNCTION public.consume_source_budget(
  p_provider text,
  p_estimated_cost numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.enrichment_source_budgets; v_cost numeric;
BEGIN
  SELECT * INTO v_row FROM public.enrichment_source_budgets WHERE source = p_provider FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed', true, 'reason', 'unconfigured'); END IF;
  IF v_row.enabled = false THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'disabled');
  END IF;
  IF v_row.reset_at < CURRENT_DATE THEN
    UPDATE public.enrichment_source_budgets
      SET spent_today_usd = 0, calls_today = 0, reset_at = CURRENT_DATE
      WHERE source = p_provider;
    v_row.spent_today_usd := 0; v_row.calls_today := 0;
  END IF;
  IF v_row.paused_until IS NOT NULL AND v_row.paused_until > now() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'paused', 'until', v_row.paused_until);
  END IF;
  v_cost := COALESCE(p_estimated_cost, v_row.cost_per_call);
  IF v_row.calls_today >= v_row.daily_call_cap THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'call_cap_reached');
  END IF;
  IF v_row.spent_today_usd + v_cost > v_row.daily_cap_usd THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'budget_cap_reached');
  END IF;
  UPDATE public.enrichment_source_budgets
    SET spent_today_usd = spent_today_usd + v_cost, calls_today = calls_today + 1
    WHERE source = p_provider;
  RETURN jsonb_build_object('allowed', true,
    'remaining_usd', v_row.daily_cap_usd - (v_row.spent_today_usd + v_cost),
    'remaining_calls', v_row.daily_call_cap - (v_row.calls_today + 1));
END; $$;
GRANT EXECUTE ON FUNCTION public.consume_source_budget(text, numeric) TO service_role;

-- D34: Contactability check
CREATE OR REPLACE FUNCTION public.check_contactability_complete(
  p_email text, p_phone text, p_linkedin text DEFAULT NULL
) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT
    p_email IS NOT NULL AND p_email <> '' AND p_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND p_phone IS NOT NULL AND length(regexp_replace(p_phone, '\D', '', 'g')) >= 10;
$$;
GRANT EXECUTE ON FUNCTION public.check_contactability_complete(text, text, text) TO service_role;

-- D39: Provider health view
CREATE OR REPLACE VIEW public.enrichment_provider_health AS
SELECT
  source AS provider,
  count(*) AS calls_7d,
  count(*) FILTER (WHERE success = true) AS successes_7d,
  ROUND(100.0 * count(*) FILTER (WHERE success = true) / NULLIF(count(*), 0), 2) AS success_rate_pct,
  ROUND(SUM(COALESCE(cost_estimate, 0))::numeric, 4) AS spent_7d,
  ROUND(AVG(COALESCE(cost_estimate, 0))::numeric, 4) AS avg_cost,
  ROUND(AVG(COALESCE(array_length(hit_fields, 1), 0))::numeric, 2) AS avg_hits,
  count(DISTINCT candidate_id) AS unique_candidates_7d,
  max(created_at) AS last_call_at
FROM public.candidate_enrichment_log
WHERE created_at > now() - interval '7 days'
GROUP BY source
ORDER BY spent_7d DESC;
GRANT SELECT ON public.enrichment_provider_health TO service_role, authenticated;

-- Seed routes
INSERT INTO public.enrichment_provider_routes (vertical, provider, call_order, requires_field, short_circuit_on) VALUES
  ('healthcare', 'npi',       1, NULL, ARRAY['npi_number']),
  ('healthcare', 'pdl',       2, NULL, ARRAY['pdl_mobile_phone','pdl_personal_email']),
  ('healthcare', 'hunter',    3, 'current_employer', NULL),
  ('healthcare', 'snov',      4, 'company_domain', NULL),
  ('healthcare', 'sonar',     5, NULL, ARRAY['linkedin_url']),
  ('healthcare', 'ninjapear', 6, 'linkedin_url', NULL),
  ('healthcare', 'lusha',     7, NULL, NULL),
  ('healthcare', 'clay',      8, NULL, NULL),
  ('trades', 'pdl',       1, NULL, ARRAY['pdl_mobile_phone','pdl_personal_email']),
  ('trades', 'sonar',     2, NULL, ARRAY['linkedin_url','current_employer']),
  ('trades', 'hunter',    3, 'current_employer', NULL),
  ('trades', 'snov',      4, 'company_domain', NULL),
  ('trades', 'ninjapear', 5, 'linkedin_url', NULL),
  ('trades', 'crustdata', 6, NULL, NULL),
  ('trades', 'lusha',     7, NULL, NULL),
  ('trades', 'clay',      8, NULL, NULL),
  ('default', 'pdl',    1, NULL, ARRAY['pdl_mobile_phone','pdl_personal_email']),
  ('default', 'hunter', 2, 'current_employer', NULL),
  ('default', 'sonar',  3, NULL, NULL),
  ('default', 'lusha',  4, NULL, NULL),
  ('default', 'clay',   5, NULL, NULL)
ON CONFLICT (vertical, provider) DO NOTHING;

-- Backfill cost_per_call for known providers
UPDATE public.enrichment_source_budgets SET cost_per_call = 0.28  WHERE source = 'pdl'       AND cost_per_call = 0;
UPDATE public.enrichment_source_budgets SET cost_per_call = 0.034 WHERE source = 'hunter'    AND cost_per_call = 0;
UPDATE public.enrichment_source_budgets SET cost_per_call = 0.012 WHERE source = 'snov'      AND cost_per_call = 0;
UPDATE public.enrichment_source_budgets SET cost_per_call = 0.40  WHERE source = 'lusha'     AND cost_per_call = 0;
UPDATE public.enrichment_source_budgets SET cost_per_call = 0.50  WHERE source = 'clay'      AND cost_per_call = 0;
UPDATE public.enrichment_source_budgets SET cost_per_call = 0.05  WHERE source = 'crustdata' AND cost_per_call = 0;
UPDATE public.enrichment_source_budgets SET cost_per_call = 0.01  WHERE source = 'ninjapear' AND cost_per_call = 0;
UPDATE public.enrichment_source_budgets SET cost_per_call = 0.005 WHERE source = 'sonar'     AND cost_per_call = 0;
