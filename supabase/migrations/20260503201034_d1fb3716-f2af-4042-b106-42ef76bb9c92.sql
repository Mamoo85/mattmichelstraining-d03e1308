SELECT cron.schedule(
  'cold-email-daily-economics',
  '0 0 * * *',
  $$select net.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/cold-email-daily-economics',
    headers:='{"Content-Type":"application/json","apikey":"eyJ.REDACTED.JWT"}'::jsonb,
    body:='{}'::jsonb
  );$$
);