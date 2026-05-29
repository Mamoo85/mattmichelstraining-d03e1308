SELECT cron.schedule(
  'trial-drip-runner-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/trial-drip-runner',
    headers := '{"Content-Type":"application/json","apikey":"eyJ.REDACTED.JWT"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
  $$
);