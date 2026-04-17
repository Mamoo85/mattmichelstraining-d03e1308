
-- Fix 18 broken crons that use extensions.http_post (doesn't exist in this Postgres) -> rebuild with net.http_post + vault pattern
-- Also fix candidate-deep-enrich-30min which referenced non-existent vault key 'supabase_url'

DO $$
DECLARE
  hardcoded_url TEXT := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  job RECORD;
BEGIN
  -- Unschedule + reschedule each broken cron with the working pattern
  FOR job IN
    SELECT jobname, schedule, command FROM cron.job
    WHERE active = true AND command ILIKE '%extensions.http_post%'
  LOOP
    PERFORM cron.unschedule(job.jobname);
  END LOOP;

  -- Also fix candidate-deep-enrich-30min (uses wrong vault key 'supabase_url')
  PERFORM cron.unschedule('candidate-deep-enrich-30min');
END $$;

-- Recreate them all with the proven working pattern (net.http_post + SUPABASE_SERVICE_ROLE_KEY vault secret)

SELECT cron.schedule('abandoned-cart-weekly', '0 13 * * 2', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/abandoned-cart-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('afterjob-drip-hourly', '0 * * * *', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/afterjob-drip-runner',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('annual-review-yearly', '0 14 5 1 *', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/annual-review-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('client-report-monthly', '0 14 1 * *', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/client-report-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('contractor-lead-notify', '*/15 * * * *', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/contractor-lead-notify',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('estimate-drip-hourly', '0 * * * *', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/estimate-drip-runner',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('insurance-drip-weekly', '0 14 * * 3', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/insurance-drip-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('invoice-chaser-daily', '0 13 * * *', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/invoice-chaser-runner',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('linkedin-outreach-weekly', '0 13 * * 1', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/linkedin-outreach-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('new-mover-weekly', '0 14 * * 4', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/new-mover-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('noshow-followup-5min', '*/5 * * * *', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/noshow-followup',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('podcast-pitch-monthly', '0 14 1 * *', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/podcast-pitch-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('restaurant-menu-monthly', '0 15 1 * *', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/restaurant-menu-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('review-monitor-6h', '0 */6 * * *', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/review-monitor',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('sms-product-monitor-daily', '0 14 * * *', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/sms-product-monitor',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('testimonial-harvester-weekly', '0 14 * * 5', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/testimonial-harvester-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('trial-day6-conversion-email', '0 15 * * *', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/trial-day6-email',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('weekly-sms-blast-tuesday', '0 14 * * 2', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/weekly-sms-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);

-- Fix candidate-deep-enrich (was using non-existent vault key 'supabase_url')
SELECT cron.schedule('candidate-deep-enrich-30min', '15,45 * * * *', $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/candidate-deep-enrich',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)),
    body := '{}'::jsonb
  );
$$);
