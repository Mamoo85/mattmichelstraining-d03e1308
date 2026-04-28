-- 1. CONFIDENCE COLUMN
ALTER TABLE public.contractor_outreach_prospects
  ADD COLUMN IF NOT EXISTS enrichment_confidence INTEGER;
CREATE INDEX IF NOT EXISTS idx_contractor_prospects_confidence
  ON public.contractor_outreach_prospects(enrichment_confidence)
  WHERE enrichment_confidence IS NOT NULL;

-- 2. DEAD LETTER QUEUE
CREATE TABLE IF NOT EXISTS public.enrichment_dead_letter (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL,
  stage TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  last_payload JSONB,
  next_retry_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() + interval '30 minutes',
  permanent_failure BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, stage)
);
CREATE INDEX IF NOT EXISTS idx_enrichment_dlq_next_retry
  ON public.enrichment_dead_letter(next_retry_at) WHERE permanent_failure = false;
CREATE INDEX IF NOT EXISTS idx_enrichment_dlq_prospect ON public.enrichment_dead_letter(prospect_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_dlq_permanent ON public.enrichment_dead_letter(permanent_failure, updated_at DESC);
ALTER TABLE public.enrichment_dead_letter ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_dlq" ON public.enrichment_dead_letter;
CREATE POLICY "service_role_all_dlq" ON public.enrichment_dead_letter FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_select_dlq" ON public.enrichment_dead_letter;
CREATE POLICY "admin_select_dlq" ON public.enrichment_dead_letter FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. REPLAY LOG
CREATE TABLE IF NOT EXISTS public.enrichment_replay_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('backfill','replay_single','replay_batch','dlq_drain','e2e_verify')),
  dry_run BOOLEAN NOT NULL DEFAULT false,
  requested INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  succeeded INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  emails_recovered INTEGER NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_by TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_replay_log_kind_started ON public.enrichment_replay_log(kind, started_at DESC);
ALTER TABLE public.enrichment_replay_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_replay" ON public.enrichment_replay_log;
CREATE POLICY "service_role_all_replay" ON public.enrichment_replay_log FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_select_replay" ON public.enrichment_replay_log;
CREATE POLICY "admin_select_replay" ON public.enrichment_replay_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. WALKER RUNS
CREATE TABLE IF NOT EXISTS public.enrichment_walker_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade TEXT NOT NULL,
  city TEXT NOT NULL,
  unenriched_count INTEGER NOT NULL DEFAULT 0,
  attempted INTEGER NOT NULL DEFAULT 0,
  succeeded INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  cost_estimate_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  skipped_reason TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  ran_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_walker_runs_ran_at ON public.enrichment_walker_runs(ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_walker_runs_pair ON public.enrichment_walker_runs(trade, city, ran_at DESC);
ALTER TABLE public.enrichment_walker_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_walker" ON public.enrichment_walker_runs;
CREATE POLICY "service_role_all_walker" ON public.enrichment_walker_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_select_walker" ON public.enrichment_walker_runs;
CREATE POLICY "admin_select_walker" ON public.enrichment_walker_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. RUN PROGRESS
CREATE TABLE IF NOT EXISTS public.enrichment_run_progress (
  progress_id UUID NOT NULL PRIMARY KEY,
  kind TEXT NOT NULL,
  step TEXT NOT NULL DEFAULT 'starting',
  processed INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  done BOOLEAN NOT NULL DEFAULT false,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_run_progress_started ON public.enrichment_run_progress(started_at DESC);
ALTER TABLE public.enrichment_run_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_progress" ON public.enrichment_run_progress;
CREATE POLICY "service_role_all_progress" ON public.enrichment_run_progress FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_select_progress" ON public.enrichment_run_progress;
CREATE POLICY "admin_select_progress" ON public.enrichment_run_progress FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.enrichment_run_progress;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. ALERT THRESHOLDS + LOG
CREATE TABLE IF NOT EXISTS public.enrichment_alert_thresholds (
  kind TEXT PRIMARY KEY,
  warn_value NUMERIC NOT NULL,
  crit_value NUMERIC NOT NULL,
  sms_enabled BOOLEAN NOT NULL DEFAULT true,
  cooldown_minutes INTEGER NOT NULL DEFAULT 30,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.enrichment_alert_thresholds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_thresholds" ON public.enrichment_alert_thresholds;
CREATE POLICY "service_role_all_thresholds" ON public.enrichment_alert_thresholds FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_all_thresholds" ON public.enrichment_alert_thresholds;
CREATE POLICY "admin_all_thresholds" ON public.enrichment_alert_thresholds FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.enrichment_alert_thresholds (kind, warn_value, crit_value, sms_enabled, cooldown_minutes, description) VALUES
  ('error_rate_60min_pct', 25, 50, true, 30, 'Enrichment error rate over last 60 minutes (pct)'),
  ('backlog_unenriched',   500, 2000, true, 60, 'Statewide unenriched prospect backlog count'),
  ('dlq_depth',            50, 200, true, 60, 'Dead-letter queue depth (non-permanent)'),
  ('daily_spend_usd',      50, 100, true, 120, 'Daily provider spend in USD'),
  ('cron_overdue_hours',   4, 12, true, 60, 'Hours since last successful Sprint D cron run')
ON CONFLICT (kind) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.outreach_alerts_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('warn','crit')),
  value NUMERIC,
  message TEXT NOT NULL,
  sms_sent BOOLEAN NOT NULL DEFAULT false,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_log_kind_created ON public.outreach_alerts_log(kind, created_at DESC);
ALTER TABLE public.outreach_alerts_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_alerts_log" ON public.outreach_alerts_log;
CREATE POLICY "service_role_all_alerts_log" ON public.outreach_alerts_log FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_select_alerts_log" ON public.outreach_alerts_log;
CREATE POLICY "admin_select_alerts_log" ON public.outreach_alerts_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. E2E RUNS
CREATE TABLE IF NOT EXISTS public.enrichment_e2e_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('passed','failed','partial')),
  stages_ok INTEGER NOT NULL DEFAULT 0,
  stages_total INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  baseline_p50_ms INTEGER,
  regression_detected BOOLEAN NOT NULL DEFAULT false,
  trace JSONB NOT NULL DEFAULT '[]'::jsonb,
  error TEXT,
  ran_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_e2e_runs_ran_at ON public.enrichment_e2e_runs(ran_at DESC);
ALTER TABLE public.enrichment_e2e_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_e2e" ON public.enrichment_e2e_runs;
CREATE POLICY "service_role_all_e2e" ON public.enrichment_e2e_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_select_e2e" ON public.enrichment_e2e_runs;
CREATE POLICY "admin_select_e2e" ON public.enrichment_e2e_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 8. CITY COVERAGE VIEW
CREATE OR REPLACE VIEW public.outreach_city_coverage WITH (security_invoker = true) AS
SELECT
  COALESCE(p.city, 'Unknown') AS city,
  COALESCE(p.state, 'MI') AS state,
  COALESCE(p.territory_priority, 99) AS tier,
  COALESCE(p.source, 'unknown') AS source,
  COUNT(*)::int AS swept_count,
  COUNT(p.email)::int AS enriched_count,
  CASE WHEN COUNT(*) = 0 THEN 0
       ELSE ROUND(COUNT(p.email)::numeric / COUNT(*) * 100, 1) END AS pct_enriched,
  MAX(p.created_at) AS last_swept_at,
  MAX(p.enriched_at) AS last_enriched_at,
  COUNT(*) FILTER (WHERE p.email IS NULL AND p.unsubscribed_at IS NULL)::int AS unenriched_remaining
FROM public.contractor_outreach_prospects p
GROUP BY p.city, p.state, p.territory_priority, p.source;
GRANT SELECT ON public.outreach_city_coverage TO authenticated;

-- 9. LIVE ERROR RATES (uses metadata, not meta; groups by channel)
CREATE OR REPLACE VIEW public.enrichment_error_rates_live WITH (security_invoker = true) AS
WITH recent AS (
  SELECT
    COALESCE(channel, 'unknown') AS channel,
    (event IN ('error','bounce','suppressed') OR reason ILIKE '%error%' OR reason ILIKE '%fail%') AS is_failure,
    (reason ILIKE '%non_json%' OR reason ILIKE '%parse%' OR reason ILIKE '%malformed%') AS is_parse_fail,
    created_at
  FROM public.contractor_outreach_audit_log
  WHERE created_at > now() - interval '60 minutes'
)
SELECT
  channel AS stage,
  COUNT(*)::int AS total_events,
  COUNT(*) FILTER (WHERE is_failure)::int AS failures,
  COUNT(*) FILTER (WHERE is_parse_fail)::int AS parse_failures,
  CASE WHEN COUNT(*) = 0 THEN 0
       ELSE ROUND(COUNT(*) FILTER (WHERE is_failure)::numeric / COUNT(*) * 100, 1) END AS failure_rate_pct
FROM recent
GROUP BY channel;
GRANT SELECT ON public.enrichment_error_rates_live TO authenticated;

-- 10. CRON RUN STATUS VIEW
CREATE OR REPLACE VIEW public.cron_run_status WITH (security_invoker = true) AS
SELECT
  j.jobid, j.jobname, j.schedule, j.active,
  (SELECT MAX(d.start_time) FROM cron.job_run_details d WHERE d.jobid = j.jobid) AS last_run_at,
  (SELECT d.status FROM cron.job_run_details d WHERE d.jobid = j.jobid ORDER BY d.start_time DESC LIMIT 1) AS last_status,
  (SELECT EXTRACT(EPOCH FROM (d.end_time - d.start_time))::int FROM cron.job_run_details d WHERE d.jobid = j.jobid AND d.end_time IS NOT NULL ORDER BY d.start_time DESC LIMIT 1) AS last_duration_s
FROM cron.job j
WHERE j.jobname IN (
  'contractor-outreach-statewide-sweep-weekly',
  'contractor-outreach-statewide-sweep-4h',
  'contractor-outreach-statewide-enrich-30m',
  'enrichment-walker-30m',
  'enrichment-dlq-drain-15m',
  'enrichment-alert-watchdog-10m',
  'enrichment-e2e-verify-nightly'
);
GRANT SELECT ON public.cron_run_status TO authenticated;

-- 11. RPCs
CREATE OR REPLACE FUNCTION public.upsert_enrichment_dead_letter(
  _prospect_id UUID, _stage TEXT, _error TEXT, _payload JSONB, _next_retry_at TIMESTAMP WITH TIME ZONE
) RETURNS public.enrichment_dead_letter
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result public.enrichment_dead_letter;
BEGIN
  INSERT INTO public.enrichment_dead_letter (prospect_id, stage, last_error, last_payload, next_retry_at)
  VALUES (_prospect_id, _stage, _error, _payload, _next_retry_at)
  ON CONFLICT (prospect_id, stage) DO UPDATE
    SET attempt_count = enrichment_dead_letter.attempt_count + 1,
        last_error = EXCLUDED.last_error,
        last_payload = EXCLUDED.last_payload,
        next_retry_at = EXCLUDED.next_retry_at,
        permanent_failure = enrichment_dead_letter.attempt_count + 1 >= 6,
        updated_at = now()
  RETURNING * INTO result;
  RETURN result;
END; $$;
GRANT EXECUTE ON FUNCTION public.upsert_enrichment_dead_letter(UUID,TEXT,TEXT,JSONB,TIMESTAMP WITH TIME ZONE) TO service_role;

CREATE OR REPLACE FUNCTION public.reclaim_dead_letter_aged()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER;
BEGIN
  WITH aged AS (
    UPDATE public.enrichment_dead_letter
    SET permanent_failure = true, updated_at = now()
    WHERE permanent_failure = false AND created_at < now() - interval '7 days'
    RETURNING prospect_id
  )
  INSERT INTO public.contractor_outreach_suppression (contact, contact_type, reason)
  SELECT DISTINCT
    COALESCE(p.email, p.phone, p.business_name || '@unenrichable'),
    CASE WHEN p.email IS NOT NULL THEN 'email'
         WHEN p.phone IS NOT NULL THEN 'phone'
         ELSE 'business' END,
    'unenrichable_dlq_7d'
  FROM aged a JOIN public.contractor_outreach_prospects p ON p.id = a.prospect_id
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;
GRANT EXECUTE ON FUNCTION public.reclaim_dead_letter_aged() TO service_role;