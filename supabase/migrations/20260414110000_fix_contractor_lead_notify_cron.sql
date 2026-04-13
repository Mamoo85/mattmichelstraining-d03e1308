-- Fix contractor-lead-notify cron — was using current_setting() which returns NULL in pg_cron.
-- Recreate using vault.decrypted_secrets pattern (same fix applied to 19 other crons in 20260413000000).

SELECT cron.unschedule('contractor-lead-notify')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'contractor-lead-notify');

SELECT cron.schedule(
  'contractor-lead-notify',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/contractor-lead-notify',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;
