SELECT cron.schedule(
  'gng-subscription-fulfillment-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qsvyvnzcacwjwjpdlymv.supabase.co/functions/v1/gng-subscription-fulfillment',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);