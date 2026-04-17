-- Cron schedules for service-health-monitor (every 30 min) and endpoint-drift-detector (weekly Sunday 3am ET / 7am UTC)

-- Remove the old broken pipeline-health-check cron if it exists
DO $$ BEGIN
  PERFORM cron.unschedule('pipeline-health-check-hourly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('pipeline-health-check-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('service-health-monitor-30min');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  PERFORM cron.unschedule('endpoint-drift-detector-weekly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Service health monitor: every 30 minutes
SELECT cron.schedule(
  'service-health-monitor-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/service-health-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Endpoint drift detector: weekly Sunday 7am UTC (3am ET)
SELECT cron.schedule(
  'endpoint-drift-detector-weekly',
  '0 7 * * 0',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/endpoint-drift-detector',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);