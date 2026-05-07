-- Change email-deliverability-check from weekly (Mon 7am ET) to daily 10am ET (14:00 UTC).
-- Weekly cadence is too slow to catch a domain blacklisting event before real damage occurs.

SELECT cron.unschedule('email-deliverability-check-weekly');

SELECT cron.schedule(
  'email-deliverability-check-daily',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/email-deliverability-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);
