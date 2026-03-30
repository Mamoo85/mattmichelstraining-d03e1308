-- ============================================================
-- MULTI-SERVICE DRIP CRON
-- Runs Tue & Thu at 11am ET — pitches full service portfolio
-- to leads that have been emailed but haven't converted.
-- ============================================================

SELECT cron.schedule(
  'multi-service-drip-tue',
  '0 15 * * 2',
  $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/multi-service-drip',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key' LIMIT 1
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'multi-service-drip-thu',
  '0 15 * * 4',
  $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/multi-service-drip',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key' LIMIT 1
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
