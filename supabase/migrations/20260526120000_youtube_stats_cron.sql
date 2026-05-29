-- youtube-stats-collector: run daily at 8am UTC to pull view/like/comment counts
SELECT cron.unschedule('youtube-stats-collector-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'youtube-stats-collector-daily');

SELECT cron.schedule(
  'youtube-stats-collector-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/youtube-stats-collector',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'),
      'Content-Type', 'application/json'
    ),
    body := '{}'
  )
  $$
);
