SELECT cron.schedule(
  'pod-listing-reaper',
  '0 6 1 * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/pod-listing-reaper',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY'), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  )$$
);
