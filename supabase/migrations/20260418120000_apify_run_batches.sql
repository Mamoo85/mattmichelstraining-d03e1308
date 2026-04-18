-- apify_run_batches: tracks each hire-alert-scanner dispatch of 3 Apify Actor runs.
-- hire-alert-scanner inserts a row before dispatching, apify-results-handler marks each source done.
-- Without this table the scanner's dispatchApifyRuns() throws on INSERT and Apify is never triggered.

CREATE TABLE IF NOT EXISTS public.apify_run_batches (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        text        NOT NULL UNIQUE,
  run_at          timestamptz NOT NULL DEFAULT now(),
  miosha_run_id   text,
  indeed_run_id   text,
  linkedin_run_id text,
  miosha_done     boolean     NOT NULL DEFAULT false,
  indeed_done     boolean     NOT NULL DEFAULT false,
  linkedin_done   boolean     NOT NULL DEFAULT false,
  candidates_found int        NOT NULL DEFAULT 0,
  alerts_sent     int         NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_apify_run_batches_run_at
  ON public.apify_run_batches (run_at DESC);

ALTER TABLE public.apify_run_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_apify_run_batches"
  ON public.apify_run_batches
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
