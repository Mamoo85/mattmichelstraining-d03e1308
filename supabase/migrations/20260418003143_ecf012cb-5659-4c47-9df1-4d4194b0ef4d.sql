-- Cron Sentinel: autonomous cron + scanner watchdog
-- Tracks expected crons, last-runs, and downstream output freshness.

CREATE TABLE IF NOT EXISTS public.cron_sentinel_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,                  -- 'pass' | 'fail' | 'warn'
  total_checks int NOT NULL DEFAULT 0,
  failures int NOT NULL DEFAULT 0,
  failure_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  full_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  notified_admin boolean NOT NULL DEFAULT false,
  trigger_source text DEFAULT 'cron'     -- 'cron' | 'manual' | 'post_deploy'
);

CREATE INDEX IF NOT EXISTS idx_cron_sentinel_alerts_checked_at
  ON public.cron_sentinel_alerts(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_sentinel_alerts_status
  ON public.cron_sentinel_alerts(status) WHERE status != 'pass';

ALTER TABLE public.cron_sentinel_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access cron_sentinel_alerts"
  ON public.cron_sentinel_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins read cron_sentinel_alerts"
  ON public.cron_sentinel_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Snooze table — admin can silence a specific cron when intentionally down
CREATE TABLE IF NOT EXISTS public.cron_sentinel_snoozes (
  cron_name text PRIMARY KEY,
  snoozed_until timestamptz NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_sentinel_snoozes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access cron_sentinel_snoozes"
  ON public.cron_sentinel_snoozes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins manage cron_sentinel_snoozes"
  ON public.cron_sentinel_snoozes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Schedule the Sentinel itself every 6 hours using vault pattern (NEVER current_setting!)
DO $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE 'Vault secrets not found — Sentinel cron will be created via UI later';
    RETURN;
  END IF;

  PERFORM cron.unschedule('cron-sentinel-6h') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cron-sentinel-6h'
  );

  PERFORM cron.schedule(
    'cron-sentinel-6h',
    '0 */6 * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{"trigger":"cron"}'::jsonb
      );
    $job$,
    v_url || '/functions/v1/cron-sentinel',
    json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text
    )
  );
END $$;