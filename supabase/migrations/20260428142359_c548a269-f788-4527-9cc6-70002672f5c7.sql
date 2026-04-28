-- Sprint Wave 3 (corrected: security_invoker on view)

CREATE TABLE IF NOT EXISTS public.enrichment_provider_latency (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  stage TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  ok BOOLEAN NOT NULL,
  status_code INTEGER,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  sampled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_epl_provider_time ON public.enrichment_provider_latency (provider, sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_epl_sampled_at ON public.enrichment_provider_latency (sampled_at DESC);
ALTER TABLE public.enrichment_provider_latency ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_epl" ON public.enrichment_provider_latency FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_select_epl" ON public.enrichment_provider_latency FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE VIEW public.enrichment_provider_latency_live
WITH (security_invoker = true) AS
SELECT
  provider,
  COUNT(*)::INTEGER AS sample_count,
  ROUND(AVG(duration_ms))::INTEGER AS avg_ms,
  PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY duration_ms)::INTEGER AS p50_ms,
  PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY duration_ms)::INTEGER AS p95_ms,
  PERCENTILE_DISC(0.99) WITHIN GROUP (ORDER BY duration_ms)::INTEGER AS p99_ms,
  ROUND(100.0 * SUM(CASE WHEN ok THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS success_pct,
  MAX(sampled_at) AS last_sample_at
FROM public.enrichment_provider_latency
WHERE sampled_at > now() - interval '60 minutes'
GROUP BY provider
ORDER BY provider;
GRANT SELECT ON public.enrichment_provider_latency_live TO authenticated;

CREATE TABLE IF NOT EXISTS public.enrichment_walker_targets (
  trade TEXT NOT NULL,
  city TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority SMALLINT NOT NULL DEFAULT 3,
  max_per_run INTEGER NOT NULL DEFAULT 25,
  daily_cost_cap_usd NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  last_walked_at TIMESTAMPTZ,
  notes TEXT,
  PRIMARY KEY (trade, city)
);
ALTER TABLE public.enrichment_walker_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_ewt" ON public.enrichment_walker_targets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_ewt" ON public.enrichment_walker_targets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.enrichment_walker_targets (trade, city, priority, max_per_run, daily_cost_cap_usd) VALUES
  ('hvac', 'Detroit', 1, 30, 8.00),
  ('plumbing', 'Detroit', 1, 30, 8.00),
  ('electrical', 'Detroit', 1, 30, 8.00),
  ('roofing', 'Detroit', 1, 30, 8.00),
  ('hvac', 'Grosse Pointe', 1, 20, 5.00),
  ('plumbing', 'Grosse Pointe', 1, 20, 5.00),
  ('hvac', 'Warren', 2, 20, 5.00),
  ('plumbing', 'Warren', 2, 20, 5.00),
  ('roofing', 'Sterling Heights', 2, 20, 5.00),
  ('electrical', 'Royal Oak', 2, 20, 5.00),
  ('boiler', 'Detroit', 3, 15, 3.00),
  ('siding', 'Detroit', 3, 15, 3.00)
ON CONFLICT (trade, city) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.outreach_alert_cooldowns (
  kind TEXT PRIMARY KEY,
  last_fired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_severity TEXT NOT NULL,
  last_value NUMERIC
);
ALTER TABLE public.outreach_alert_cooldowns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_oac" ON public.outreach_alert_cooldowns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_select_oac" ON public.outreach_alert_cooldowns FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.record_provider_latency(
  _provider TEXT, _stage TEXT, _duration_ms INTEGER, _ok BOOLEAN,
  _status_code INTEGER DEFAULT NULL, _meta JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.enrichment_provider_latency
    (provider, stage, duration_ms, ok, status_code, meta)
  VALUES (_provider, _stage, _duration_ms, _ok, _status_code, _meta);
END;
$$;
REVOKE ALL ON FUNCTION public.record_provider_latency(TEXT, TEXT, INTEGER, BOOLEAN, INTEGER, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_provider_latency(TEXT, TEXT, INTEGER, BOOLEAN, INTEGER, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.prune_provider_latency() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE deleted INTEGER;
BEGIN
  DELETE FROM public.enrichment_provider_latency WHERE sampled_at < now() - interval '7 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
REVOKE ALL ON FUNCTION public.prune_provider_latency() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_provider_latency() TO service_role;