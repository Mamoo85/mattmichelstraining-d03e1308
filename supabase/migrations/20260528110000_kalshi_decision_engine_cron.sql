-- kalshi-decision-engine: run every 30 minutes
-- Scans Kalshi markets, applies GPT-4o edge detection, places trades via kalshi-trader.
-- Also removes the broken kalshi-trader-hourly cron (called with empty body = no-op).

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('kalshi-decision-engine', 'kalshi-trader-hourly');

SELECT cron.schedule(
  'kalshi-decision-engine',
  '*/30 * * * *',
  $$SELECT net.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/kalshi-decision-engine',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body:='{}'::jsonb
  )$$
);
