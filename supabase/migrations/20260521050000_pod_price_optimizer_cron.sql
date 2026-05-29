SELECT cron.schedule(
  'pod-price-optimizer',
  '0 5 * * 0',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/pod-price-audit',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY'), 'Content-Type', 'application/json'),
    body := '{"autoAdjust":true}'::jsonb
  )$$
);
