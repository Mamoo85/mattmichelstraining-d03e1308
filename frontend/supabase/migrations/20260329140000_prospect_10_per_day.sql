-- ============================================================
-- UPGRADE PROSPECTING: 10 leads/day, rotating industries
-- Replaces the 2x/week schedule with 2x daily runs.
-- Each run fetches 5 leads. Industries/cities auto-rotate
-- based on day-of-year/month inside the edge function.
-- 10/day is well within CAN-SPAM safe limits and Resend's
-- deliverability guidelines (personalized, targeted, low volume).
-- ============================================================

-- Remove old twice-a-week prospect jobs
DO $$
BEGIN
  BEGIN PERFORM cron.unschedule('prospect-businesses-mon'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('prospect-businesses-wed'); EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- Morning run: 9am ET (13:00 UTC) — 5 leads, auto-rotates industry
SELECT cron.schedule(
  'prospect-businesses-morning',
  '0 13 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/prospect-local-businesses',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key' LIMIT 1
      )
    ),
    body := '{"limit":5}'::jsonb
  ) AS request_id;
  $$
);

-- Afternoon run: 2pm ET (18:00 UTC) — 5 leads, different industry (rotates separately)
SELECT cron.schedule(
  'prospect-businesses-afternoon',
  '0 18 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/prospect-local-businesses',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key' LIMIT 1
      )
    ),
    body := '{"limit":5}'::jsonb
  ) AS request_id;
  $$
);

-- Result: 10 new leads/day, 30 industries in rotation, 10 Metro Detroit cities
-- Pipeline: ~300 leads/month → drip sequence → ~15-25 responses → 2-4 closes/month
