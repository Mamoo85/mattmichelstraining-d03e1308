-- Demand Radar client onboarding drip — runs daily at noon ET (16:00 UTC)
SELECT cron.schedule(
  'industry-pulse-client-drip-daily',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/industry-pulse-client-drip',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
