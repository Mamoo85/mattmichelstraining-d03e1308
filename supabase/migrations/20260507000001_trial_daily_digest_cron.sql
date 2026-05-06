-- Daily cron for trial-daily-digest at 13:00 UTC (9am ET).
-- Sends Matt a daily SMS with trial funnel health: active, new, expired no-convert.
SELECT cron.schedule(
  'trial-daily-digest-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/trial-daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);
