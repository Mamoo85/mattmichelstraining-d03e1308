-- etsy-digital-uploader now runs at 1 listing per call (compute limit fix)
-- Fire 3x daily: 2pm, 2:30pm, 3pm UTC to get 3 listings/day
SELECT cron.unschedule('etsy-digital-uploader') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'etsy-digital-uploader'
);
SELECT cron.schedule(
  'etsy-digital-uploader-1',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/etsy-digital-uploader',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
SELECT cron.schedule(
  'etsy-digital-uploader-2',
  '30 14 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/etsy-digital-uploader',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
SELECT cron.schedule(
  'etsy-digital-uploader-3',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/etsy-digital-uploader',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
