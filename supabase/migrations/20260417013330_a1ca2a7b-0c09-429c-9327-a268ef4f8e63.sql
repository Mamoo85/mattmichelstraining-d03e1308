-- Fix trojan-horse-upsell cron — original used current_setting('app.settings.supabase_url')
-- which returns NULL in pg_cron context, causing the cron to silently no-op.
-- Replaces it with the vault.decrypted_secrets pattern used in 20260413000000_fix_broken_crons.

SELECT cron.unschedule('trojan-horse-upsell-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trojan-horse-upsell-daily');

SELECT cron.schedule(
  'trojan-horse-upsell-daily',
  '0 14 * * *',  -- 10am ET (14:00 UTC)
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/trojan-horse-upsell',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);