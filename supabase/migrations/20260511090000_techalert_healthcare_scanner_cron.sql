-- techalert-healthcare-scanner cron — daily 9am ET (13:00 UTC)
-- Scans LARA for new nursing licenses + Google Maps for nursing home prospects
-- Must run BEFORE techalert-enrich (10am) and techalert-outreach (11am) so
-- healthcare prospects are enriched and emailed the same day they're discovered.

SELECT cron.schedule(
  'techalert-healthcare-scanner-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/techalert-healthcare-scanner',
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
