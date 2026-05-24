
DO $$
DECLARE
  j RECORD;
BEGIN
  FOR j IN
    SELECT jobname FROM cron.job
    WHERE jobname IN (
      'cold-sender-master-30m',
      'cold-email-ramp-scheduler-daily',
      'cold-sender-health-check-daily'
    )
  LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;
END$$;

SELECT cron.schedule(
  'cold-sender-master-30m',
  '0,30 13-20 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/cold-sender-master',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'cold-email-ramp-scheduler-daily',
  '30 4 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/cold-email-ramp-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'cold-sender-health-check-daily',
  '0 12 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/cold-sender-health-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
