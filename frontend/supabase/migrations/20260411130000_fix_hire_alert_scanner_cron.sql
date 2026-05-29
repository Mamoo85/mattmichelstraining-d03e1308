-- Fix hire-alert-scanner-daily cron
-- Original migration used current_setting('app.supabase_url') which is not
-- configured, so the cron was never created. Re-create using vault.decrypted_secrets
-- to match the pattern used by all working crons.

SELECT cron.unschedule('hire-alert-scanner-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hire-alert-scanner-daily');

SELECT cron.schedule(
  'hire-alert-scanner-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/hire-alert-scanner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  )
  $$
);
