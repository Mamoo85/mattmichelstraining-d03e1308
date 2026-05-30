
-- Bump cold outreach to 25+/day, every day
DO $$
BEGIN
  BEGIN PERFORM cron.unschedule('prospect-businesses-mon'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('prospect-businesses-tue'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('prospect-businesses-wed'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('prospect-businesses-thu'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('prospect-businesses-fri'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('prospect-businesses-morning'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('prospect-businesses-afternoon'); EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- Morning run: 9am ET (13:00 UTC) — 13 leads, every day
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
    body := '{"limit":13}'::jsonb
  ) AS request_id;
  $$
);

-- Afternoon run: 2pm ET (18:00 UTC) — 12 leads, every day
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
    body := '{"limit":12}'::jsonb
  ) AS request_id;
  $$
);
