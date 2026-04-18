-- Schedule lara-fast-scanner every 30 minutes for instant new-license detection
-- This is the "we alert you the moment a license hits the system" engine.
-- Runs separately from the heavier 4-hour main scanner so it's never starved.

DO $$
DECLARE
  v_supabase_url text;
  v_service_key text;
BEGIN
  -- Pull from vault (safe inside cron context, unlike current_setting)
  SELECT decrypted_secret INTO v_supabase_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  -- Unschedule if exists (idempotent)
  PERFORM cron.unschedule('lara-fast-scanner-30min')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lara-fast-scanner-30min');

  PERFORM cron.schedule(
    'lara-fast-scanner-30min',
    '*/30 * * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', %L
        ),
        body := '{}'::jsonb
      );
      $cron$,
      v_supabase_url || '/functions/v1/lara-fast-scanner',
      'Bearer ' || v_service_key
    )
  );
END $$;