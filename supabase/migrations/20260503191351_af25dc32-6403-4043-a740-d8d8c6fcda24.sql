
-- ============================================================================
-- 1. KPI table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.enrichment_run_kpis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_at timestamptz NOT NULL DEFAULT now(),
  function_name text NOT NULL,
  triggered_by text NOT NULL DEFAULT 'cron',
  leads_attempted integer NOT NULL DEFAULT 0,
  leads_enriched integer NOT NULL DEFAULT 0,
  leads_failed integer NOT NULL DEFAULT 0,
  leads_skipped integer NOT NULL DEFAULT 0,
  provider_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_duration_ms integer NOT NULL DEFAULT 0,
  avg_ms_per_lead integer NOT NULL DEFAULT 0,
  cost_cents_total integer NOT NULL DEFAULT 0,
  target_gap integer,
  throughput_per_hour numeric,
  meets_target boolean,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_enrichment_run_kpis_run_at
  ON public.enrichment_run_kpis(run_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_run_kpis_fn_run_at
  ON public.enrichment_run_kpis(function_name, run_at DESC);

ALTER TABLE public.enrichment_run_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages run kpis"
  ON public.enrichment_run_kpis
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admins read run kpis"
  ON public.enrichment_run_kpis
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================================
-- 2. Circuit breaker state
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.enrichment_circuit_breaker_state (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tripped_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  metric_value numeric NOT NULL,
  threshold numeric NOT NULL,
  provider text,
  cleared_at timestamptz,
  auto_reset_at timestamptz NOT NULL DEFAULT (now() + interval '6 hours'),
  notes text,
  CONSTRAINT enrichment_circuit_breaker_reason_chk
    CHECK (reason = ANY (ARRAY['failure_rate', 'bounce_rate', 'cost_runaway', 'manual']))
);

CREATE INDEX IF NOT EXISTS idx_breaker_active
  ON public.enrichment_circuit_breaker_state(tripped_at DESC)
  WHERE cleared_at IS NULL;

ALTER TABLE public.enrichment_circuit_breaker_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages breaker"
  ON public.enrichment_circuit_breaker_state
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admins manage breaker"
  ON public.enrichment_circuit_breaker_state
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================================
-- 3. Provider spend today view
-- ============================================================================
CREATE OR REPLACE VIEW public.provider_spend_today
WITH (security_invoker = true) AS
SELECT
  COALESCE(provider, 'unknown') AS provider,
  COUNT(*) AS calls,
  COUNT(*) FILTER (WHERE success) AS successes,
  COUNT(*) FILTER (WHERE NOT success) AS failures,
  COALESCE(SUM(cost_cents), 0) AS spend_cents
FROM public.lead_enrichment_audit
WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York'
GROUP BY COALESCE(provider, 'unknown');

GRANT SELECT ON public.provider_spend_today TO authenticated, service_role;

-- ============================================================================
-- 4. Seed config keys (per-provider budgets + breaker thresholds)
-- ============================================================================
INSERT INTO public.enrichment_walker_config (key, value_numeric, value_text)
VALUES
  ('apollo_daily_budget_usd',     30, NULL),
  ('hunter_daily_budget_usd',     15, NULL),
  ('firecrawl_daily_budget_usd',   5, NULL),
  ('apollo_max_budget_usd',      120, NULL),
  ('hunter_max_budget_usd',       60, NULL),
  ('firecrawl_max_budget_usd',    20, NULL),
  ('max_total_budget_usd',       200, NULL),
  ('failure_rate_threshold',     0.40, NULL),
  ('bounce_rate_threshold',      0.08, NULL),
  ('cost_per_validated_threshold_cents', 75, NULL),
  ('budget_frozen',               0,  'false'),
  ('throughput_alert_floor_ratio', 0.6, NULL)
ON CONFLICT (key) DO NOTHING;
