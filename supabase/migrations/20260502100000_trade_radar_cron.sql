-- Daily cron for trade-radar-scanner at 8am ET (13:00 UTC).
-- Hardcoded URL + anon key — vault secrets return NULL in pg_cron context.

SELECT cron.unschedule('trade-radar-scanner-daily')
  WHERE EXISTS (SELECT FROM cron.job WHERE jobname = 'trade-radar-scanner-daily');

SELECT cron.schedule(
  'trade-radar-scanner-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/trade-radar-scanner',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJ.REDACTED.JWT"}'::jsonb,
    body := '{"vertical":"all"}'::jsonb
  );
  $$
);
