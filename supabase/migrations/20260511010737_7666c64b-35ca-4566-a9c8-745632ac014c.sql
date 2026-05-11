
-- Extend run tables with failing_step + error_code for finer-grain monitoring
ALTER TABLE public.scanner_source_runs
  ADD COLUMN IF NOT EXISTS failing_step text,
  ADD COLUMN IF NOT EXISTS error_code text;

ALTER TABLE public.scanner_extras_runs
  ADD COLUMN IF NOT EXISTS failing_step text,
  ADD COLUMN IF NOT EXISTS error_code text;

CREATE INDEX IF NOT EXISTS idx_scanner_source_runs_ok_ran_at
  ON public.scanner_source_runs (ok, ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_extras_runs_error_created
  ON public.scanner_extras_runs (created_at DESC)
  WHERE error IS NOT NULL;

-- Unified view across both run tables — single feed for dashboard
CREATE OR REPLACE VIEW public.v_scanner_runs_unified
WITH (security_invoker = true)
AS
SELECT
  'framework'::text AS engine,
  id::text          AS id,
  source,
  product,
  COALESCE(segment_null.col, 'all'::text) AS segment,
  ok,
  rows_returned     AS rows,
  duration_ms,
  error,
  failing_step,
  error_code,
  ran_at            AS ran_at
FROM public.scanner_source_runs
LEFT JOIN LATERAL (SELECT 'all'::text AS col) segment_null ON true
UNION ALL
SELECT
  'extras'::text    AS engine,
  id::text          AS id,
  source,
  product,
  COALESCE(segment, 'all'::text) AS segment,
  (error IS NULL)   AS ok,
  count             AS rows,
  ms                AS duration_ms,
  error,
  failing_step,
  error_code,
  created_at        AS ran_at
FROM public.scanner_extras_runs;

-- Alert tracking (de-dupes so we don't spam Matt every 15 min for the same outage)
CREATE TABLE IF NOT EXISTS public.scanner_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL,
  product text NOT NULL,
  source text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('warn','error','critical')),
  reason text NOT NULL,
  error_code text,
  failing_step text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  occurrences integer NOT NULL DEFAULT 1,
  alerted_at timestamptz,
  resolved_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS scanner_alerts_open_fingerprint_uq
  ON public.scanner_alerts (fingerprint)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS scanner_alerts_open_idx
  ON public.scanner_alerts (last_seen_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE public.scanner_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all_alerts ON public.scanner_alerts
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY admins_read_alerts ON public.scanner_alerts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
