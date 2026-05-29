-- Kalshi autonomous trader cron — Phase 98
-- Calls kalshi-trader edge function every hour

SELECT cron.unschedule('kalshi-trader-hourly') FROM cron.job WHERE jobname = 'kalshi-trader-hourly';

SELECT cron.schedule(
  'kalshi-trader-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/kalshi-trader',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);
