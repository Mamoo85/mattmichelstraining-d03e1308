SELECT cron.schedule(
  'cold-email-volume-sentinel-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/cold-email-volume-sentinel',
    headers := '{"Content-Type":"application/json","apikey":"eyJ.REDACTED.JWT"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);