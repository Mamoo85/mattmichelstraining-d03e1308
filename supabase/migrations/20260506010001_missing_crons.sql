-- Add missing cron schedules for demand-radar-enhanced-scan and field-service-daily-summary.
-- Both were built but never scheduled — their output tables have data but no daily refresh.

DO $$ BEGIN
  PERFORM cron.unschedule('demand-radar-enhanced-scan-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'demand-radar-enhanced-scan-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/demand-radar-enhanced-scan',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := jsonb_build_object('triggered_by','cron')
  );
  $$
);

DO $$ BEGIN
  PERFORM cron.unschedule('field-service-daily-summary-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'field-service-daily-summary-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/field-service-daily-summary',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := jsonb_build_object('triggered_by','cron')
  );
  $$
);
