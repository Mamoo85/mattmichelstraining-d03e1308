-- Daily cron: onboarding-followup fires at 10am ET (14:00 UTC) to nudge
-- SiteRadar and Missed-Call clients who haven't completed setup at D3 and D7.
SELECT cron.schedule(
  'onboarding-followup-daily',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/onboarding-followup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
