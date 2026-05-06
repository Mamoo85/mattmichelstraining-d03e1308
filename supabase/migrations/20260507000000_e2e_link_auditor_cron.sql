-- Daily cron for e2e-link-auditor at 11:00 UTC (7am ET).
-- Checks all trial CTAs and SMS Matt if any are broken.
SELECT cron.schedule(
  'e2e-link-auditor-daily',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/e2e-link-auditor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $$
);
