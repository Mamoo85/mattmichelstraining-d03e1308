-- Schedule hire-alert-client-drip daily at noon ET (16:00 UTC)
SELECT cron.schedule(
  'hire-alert-client-drip-daily',
  '0 16 * * *',
  $$SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/hire-alert-client-drip',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );$$
);
