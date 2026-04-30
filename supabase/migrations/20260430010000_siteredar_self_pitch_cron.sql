-- Schedule siteredar-self-pitch daily at 11:30am ET (15:30 UTC)

DO $$ BEGIN
  PERFORM cron.unschedule('siteredar-self-pitch-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'siteredar-self-pitch-daily',
  '30 15 * * *',
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/siteredar-self-pitch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body := '{}'::jsonb
    );
  $$
);
