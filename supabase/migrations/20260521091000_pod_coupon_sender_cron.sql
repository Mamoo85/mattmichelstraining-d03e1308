SELECT cron.schedule(
  'pod-coupon-sender',
  '0 15 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/pod-coupon-sender',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY'), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  )$$
);
