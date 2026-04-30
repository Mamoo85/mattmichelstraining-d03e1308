-- Schedule haro-monitor daily at 8am ET (12:00 UTC)

DO $$ BEGIN
  PERFORM cron.unschedule('haro-monitor-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'haro-monitor-daily',
  '0 12 * * *',
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/haro-monitor',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
      ),
      body := '{}'::jsonb
    );
  $$
);
