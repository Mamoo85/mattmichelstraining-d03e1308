-- Fix 1: Rebuild pipeline-health-monitor-evening cron with correct URL
-- The evening cron was only created with a broken vault-lookup URL in earlier migrations
-- and was never rebuilt in the 20260418012436 fix (which only rebuilt the morning cron).
SELECT cron.unschedule('pipeline-health-monitor-evening')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pipeline-health-monitor-evening');

SELECT cron.schedule(
  'pipeline-health-monitor-evening',
  '0 22 * * *',
  $$SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/pipeline-health-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );$$
);

-- Fix 2: Replace hire-alert-scanner-4h cron if it was created with extensions.http_post
-- (the 20260418130000 migration used the wrong pg_net alias)
-- Only runs if the cron body still references extensions.http_post
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'hire-alert-scanner-4h'
      AND command LIKE '%extensions.http_post%'
  ) THEN
    PERFORM cron.unschedule('hire-alert-scanner-4h');
    PERFORM cron.schedule(
      'hire-alert-scanner-4h',
      '0 */4 * * *',
      $job$SELECT net.http_post(
        url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/hire-alert-scanner',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)
        ),
        body := '{}'::jsonb
      );$job$
    );
  END IF;
END $$;
