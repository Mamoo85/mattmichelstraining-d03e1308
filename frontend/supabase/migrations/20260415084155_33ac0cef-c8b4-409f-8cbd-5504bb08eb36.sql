
-- API health monitoring
CREATE TABLE public.api_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name text NOT NULL,
  status text NOT NULL DEFAULT 'unknown',
  response_ms integer,
  error_message text,
  checked_at timestamptz DEFAULT now()
);
ALTER TABLE public.api_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.api_health_checks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Index for dashboard queries
CREATE INDEX idx_api_health_checks_checked_at ON public.api_health_checks (checked_at DESC);
CREATE INDEX idx_api_health_checks_api_name ON public.api_health_checks (api_name, checked_at DESC);

-- TOS compliance on hire_alert_clients
ALTER TABLE public.hire_alert_clients
  ADD COLUMN IF NOT EXISTS tos_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS tos_version text DEFAULT '1.0';

-- LARA status tracking on runs
ALTER TABLE public.hire_alert_runs
  ADD COLUMN IF NOT EXISTS lara_status text DEFAULT 'not_attempted';

-- Cron for pipeline health monitor (6am + 6pm ET = 10:00 + 22:00 UTC)
SELECT cron.schedule(
  'pipeline-health-monitor-morning',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/pipeline-health-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1)
    ),
    body := '{"source":"cron_morning"}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'pipeline-health-monitor-evening',
  '0 22 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/pipeline-health-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1)
    ),
    body := '{"source":"cron_evening"}'::jsonb
  ) AS request_id;
  $$
);
