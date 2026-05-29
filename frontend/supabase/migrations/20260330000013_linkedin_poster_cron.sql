-- Post to Matt's LinkedIn Mon/Wed/Fri at 9am ET (13:00 UTC)
SELECT cron.schedule(
  'post-to-matts-linkedin',
  '0 13 * * 1,3,5',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/post-to-linkedin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  );
  $$
);
