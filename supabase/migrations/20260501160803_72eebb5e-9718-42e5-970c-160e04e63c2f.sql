-- Schedule roofing prospect enrichment daily at 11am ET (15:00 UTC)
SELECT cron.schedule(
  'dwa-v4-roofing-enrich-daily',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/dwa-v4-roofing-enrich',
    headers := '{"Content-Type":"application/json","apikey":"eyJ.REDACTED.JWT"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);