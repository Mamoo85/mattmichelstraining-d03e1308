-- Upgrade prospecting from 10/day to 20/day
-- Two runs per day, each sending 10 leads instead of 5
DO $$
BEGIN
  BEGIN PERFORM cron.unschedule('prospect-businesses-morning'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('prospect-businesses-afternoon'); EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- Morning run: 9am ET (13:00 UTC) — 10 leads
SELECT cron.schedule(
  'prospect-businesses-morning',
  '0 13 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/prospect-local-businesses',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key' LIMIT 1
      )
    ),
    body := '{"limit":10}'::jsonb
  ) AS request_id;
  $$
);

-- Afternoon run: 2pm ET (18:00 UTC) — 10 leads
SELECT cron.schedule(
  'prospect-businesses-afternoon',
  '0 18 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/prospect-local-businesses',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key' LIMIT 1
      )
    ),
    body := '{"limit":10}'::jsonb
  ) AS request_id;
  $$
);
-- Result: 20 new prospects/day → ~600/month
