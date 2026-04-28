-- Wave 5: DLQ aging, enrichment confidence, walker budget, spend rollup

-- 1. DLQ aging columns on prospects
ALTER TABLE public.contractor_outreach_prospects
  ADD COLUMN IF NOT EXISTS suppressed_at timestamptz,
  ADD COLUMN IF NOT EXISTS suppression_reason text;

CREATE INDEX IF NOT EXISTS idx_prospects_suppressed
  ON public.contractor_outreach_prospects (suppressed_at)
  WHERE suppressed_at IS NOT NULL;

-- 2. Enrichment confidence column
ALTER TABLE public.contractor_outreach_prospects
  ADD COLUMN IF NOT EXISTS enrichment_confidence smallint NOT NULL DEFAULT 0;

ALTER TABLE public.contractor_outreach_prospects
  DROP CONSTRAINT IF EXISTS contractor_outreach_prospects_confidence_range;
ALTER TABLE public.contractor_outreach_prospects
  ADD CONSTRAINT contractor_outreach_prospects_confidence_range
  CHECK (enrichment_confidence BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS idx_prospects_confidence
  ON public.contractor_outreach_prospects (enrichment_confidence DESC)
  WHERE suppressed_at IS NULL;

-- 3. DLQ aging index (use permanent_failure flag)
CREATE INDEX IF NOT EXISTS idx_dlq_created_at
  ON public.enrichment_dead_letter (created_at)
  WHERE permanent_failure = false;

-- 4. Walker config table
CREATE TABLE IF NOT EXISTS public.enrichment_walker_config (
  key text PRIMARY KEY,
  value_numeric numeric,
  value_text text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.enrichment_walker_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role manages walker config" ON public.enrichment_walker_config;
CREATE POLICY "service role manages walker config"
  ON public.enrichment_walker_config FOR ALL
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admins read walker config" ON public.enrichment_walker_config;
CREATE POLICY "admins read walker config"
  ON public.enrichment_walker_config FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins update walker config" ON public.enrichment_walker_config;
CREATE POLICY "admins update walker config"
  ON public.enrichment_walker_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.enrichment_walker_config (key, value_numeric)
VALUES ('daily_budget_usd', 50)
ON CONFLICT (key) DO NOTHING;

-- 5. Admin RPC to set walker budget
CREATE OR REPLACE FUNCTION public.set_walker_daily_budget(usd numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;
  IF usd IS NULL OR usd < 0 OR usd > 5000 THEN
    RAISE EXCEPTION 'invalid budget: must be between 0 and 5000';
  END IF;
  INSERT INTO public.enrichment_walker_config (key, value_numeric, updated_at)
  VALUES ('daily_budget_usd', usd, now())
  ON CONFLICT (key) DO UPDATE
    SET value_numeric = EXCLUDED.value_numeric, updated_at = now();
  RETURN usd;
END;
$$;

REVOKE ALL ON FUNCTION public.set_walker_daily_budget(numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.set_walker_daily_budget(numeric) TO authenticated;

-- 6. Daily spend rollup view (security invoker so RLS on base table applies)
CREATE OR REPLACE VIEW public.enrichment_provider_spend_daily
WITH (security_invoker = true) AS
SELECT
  date_trunc('day', ran_at AT TIME ZONE 'America/Detroit')::date AS day,
  COALESCE(SUM(cost_estimate_usd), 0)::numeric(10,2) AS spend_usd,
  COUNT(*) AS run_count
FROM public.enrichment_walker_runs
GROUP BY 1
ORDER BY 1 DESC;

GRANT SELECT ON public.enrichment_provider_spend_daily TO authenticated, service_role;