-- Phase 20: Surgical waterfall improvements
-- Change 1: raw_signals_dump (additive, enables replay + drop-off math)
-- Change 2: round-robin cron schedule
-- Bug fix: lower hot-candidate alert threshold from 7 to 6 (data shows actionable score=6+ candidates being filtered out)

-- ============ raw_signals_dump table ============
CREATE TABLE IF NOT EXISTS public.raw_signals_dump (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  vertical TEXT,
  scanner TEXT NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pulled_count INTEGER,
  kept_after_gate INTEGER,
  enriched_count INTEGER,
  final_inserted INTEGER,
  ai_cost_usd NUMERIC(10,4),
  duration_ms INTEGER,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_raw_signals_dump_fetched ON public.raw_signals_dump(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_signals_dump_scanner ON public.raw_signals_dump(scanner, fetched_at DESC);

ALTER TABLE public.raw_signals_dump ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_raw_signals_dump" ON public.raw_signals_dump;
CREATE POLICY "service_role_all_raw_signals_dump" ON public.raw_signals_dump
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admins_read_raw_signals_dump" ON public.raw_signals_dump;
CREATE POLICY "admins_read_raw_signals_dump" ON public.raw_signals_dump
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ Round-robin cron schedule ============
-- Drop overlapping legacy schedules
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job
  WHERE jobname IN (
    'hire-alert-scanner-4h',
    'hire-alert-dispatcher-4h',
    'industry-pulse-scanner-daily',
    'accela-permit-scanner-4h'
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 1am ET (5am UTC): healthcare-focused hire-alert pass
SELECT cron.schedule(
  'hire-alert-healthcare-1am-et',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/hire-alert-scanner',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')),
    body := jsonb_build_object('vertical_filter','healthcare','triggered_by','cron_round_robin')
  );
  $$
);

-- 2am ET (6am UTC): industrial/trades pass
SELECT cron.schedule(
  'hire-alert-industrial-2am-et',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/hire-alert-scanner',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')),
    body := jsonb_build_object('vertical_filter','industrial','triggered_by','cron_round_robin')
  );
  $$
);

-- 3am ET (7am UTC): commercial — industry pulse + accela permits
SELECT cron.schedule(
  'industry-pulse-commercial-3am-et',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/industry-pulse-scanner',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')),
    body := jsonb_build_object('triggered_by','cron_round_robin')
  );
  $$
);

SELECT cron.schedule(
  'accela-permits-3am-et',
  '15 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/accela-permit-scanner',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')),
    body := jsonb_build_object('triggered_by','cron_round_robin')
  );
  $$
);