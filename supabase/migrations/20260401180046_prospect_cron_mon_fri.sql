-- ============================================================
-- Replace hardcoded Mon/Wed plumber+electrician Detroit runs
-- with Mon–Fri auto-rotation (no hardcoded industry/city).
-- The function auto-rotates via INDUSTRY_ROTATION + CITY_ROTATION
-- arrays indexed by day-of-year / day-of-month.
-- This 5x/week cadence increases outreach volume from ~20/week
-- to ~50/week and targets all 50+ industries across 150+ cities.
-- ============================================================

DO $$
BEGIN
  -- Remove the old hardcoded Monday/Wednesday jobs
  PERFORM cron.unschedule('prospect-businesses-mon');
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('prospect-businesses-wed');
EXCEPTION WHEN others THEN NULL;
END $$;

-- ── Mon–Fri 9am ET (13:00 UTC) — auto-rotation, no hardcoded industry/city ──

SELECT cron.schedule(
  'prospect-businesses-mon',
  '0 13 * * 1',
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
    body := '{"limit":10}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'prospect-businesses-tue',
  '0 13 * * 2',
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
    body := '{"limit":10}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'prospect-businesses-wed',
  '0 13 * * 3',
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
    body := '{"limit":10}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'prospect-businesses-thu',
  '0 13 * * 4',
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
    body := '{"limit":10}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'prospect-businesses-fri',
  '0 13 * * 5',
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
    body := '{"limit":10}'::jsonb
  ) AS request_id;
  $$
);
