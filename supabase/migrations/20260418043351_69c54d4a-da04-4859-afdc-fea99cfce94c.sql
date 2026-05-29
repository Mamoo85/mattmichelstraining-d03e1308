-- Part 1: Flight risk columns
ALTER TABLE public.hire_alert_candidates
  ADD COLUMN IF NOT EXISTS flight_risk text,
  ADD COLUMN IF NOT EXISTS flight_risk_proof text;

CREATE INDEX IF NOT EXISTS idx_hire_REDACTED
  ON public.hire_alert_candidates(flight_risk)
  WHERE flight_risk IS NOT NULL;

-- Part 2: Index on existing enrichment log (uses 'source' column, not 'provider')
CREATE INDEX IF NOT EXISTS idx_enrichment_log_source_created
  ON public.candidate_enrichment_log(source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrichment_log_created
  ON public.candidate_enrichment_log(created_at DESC);

-- Part 3: Blind teaser dispatches
CREATE TABLE IF NOT EXISTS public.blind_teaser_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_ids uuid[] NOT NULL,
  trade_summary text,
  city_summary text,
  email_html text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'pending_approval',
  approved_at timestamptz,
  approved_by uuid,
  dispatched_at timestamptz,
  recipient_count integer DEFAULT 0,
  paid_unlocks integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teaser_dispatches_status_created
  ON public.blind_teaser_dispatches(status, created_at DESC);

ALTER TABLE public.blind_teaser_dispatches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read teaser dispatches" ON public.blind_teaser_dispatches;
CREATE POLICY "Admins can read teaser dispatches"
  ON public.blind_teaser_dispatches FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update teaser dispatches" ON public.blind_teaser_dispatches;
CREATE POLICY "Admins can update teaser dispatches"
  ON public.blind_teaser_dispatches FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Service role full access teaser dispatches" ON public.blind_teaser_dispatches;
CREATE POLICY "Service role full access teaser dispatches"
  ON public.blind_teaser_dispatches FOR ALL
  USING (true) WITH CHECK (true);

-- Part 4: Crons (approved hardcoded URL pattern)
DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJ.REDACTED.JWT';
  v_hdr text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;

  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  PERFORM cron.unschedule('automated-blind-teaser-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'automated-blind-teaser-daily');
  PERFORM cron.schedule('automated-blind-teaser-daily', '0 12 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/automated-blind-teaser-generator', v_hdr));

  PERFORM cron.unschedule('enrichment-cost-report-weekly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enrichment-cost-report-weekly');
  PERFORM cron.schedule('enrichment-cost-report-weekly', '0 1 * * 1',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/enrichment-cost-report-weekly', v_hdr));
END $migration$;