-- Tom autonomous agent daily cron: 8am ET (13:00 UTC).
-- Function exists and is complete but had no pg_cron trigger.
-- Uses hardcoded URL + anon key pattern (vault secrets are NULL in cron context).

SELECT cron.unschedule('tom-autonomous-daily')
  WHERE EXISTS (SELECT FROM cron.job WHERE jobname = 'tom-autonomous-daily');

SELECT cron.schedule(
  'tom-autonomous-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/tom-autonomous',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJ.REDACTED.JWT"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
