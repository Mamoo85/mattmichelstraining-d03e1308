-- Training newsletter weekly send + repair of two timing-out Monday crons.
-- Canonical pattern: hardcoded function URL + SUPABASE_SERVICE_ROLE_KEY_VAULT.

DO $$ BEGIN PERFORM cron.unschedule('training-newsletter-weekly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('newsletter-send'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('sports-newsletter-weekly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- M2 Training newsletter: every Monday 12:00 UTC (8am ET)
SELECT cron.schedule(
  'training-newsletter-weekly',
  '0 12 * * 1',
  $cron$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/training-newsletter-send',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{"provider":"anthropic","source":"cron"}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $cron$
);

-- newsletter-send: Monday 12:00 UTC (was timing out)
SELECT cron.schedule(
  'newsletter-send',
  '0 12 * * 1',
  $cron$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/newsletter-send',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{"source":"cron"}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $cron$
);

-- sports-newsletter-weekly: Monday 13:00 UTC (was timing out)
SELECT cron.schedule(
  'sports-newsletter-weekly',
  '0 13 * * 1',
  $cron$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/sports-newsletter-weekly',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{"source":"cron"}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $cron$
);