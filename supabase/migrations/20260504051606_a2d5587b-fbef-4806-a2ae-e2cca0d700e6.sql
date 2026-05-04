
DO $$ BEGIN
  PERFORM cron.unschedule('anniversary-notice-sender-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'anniversary-notice-sender-daily',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/anniversary-notice-sender',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')),
    body := '{}'::jsonb
  );
  $$
);
