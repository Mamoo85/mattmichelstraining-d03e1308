-- dwa-ad-factory weekly cron — runs Monday 4am UTC (Sunday 11pm ET)
-- Creates one DWA product video ad per week, rotating through 6 products.
-- heygen-webhook picks up completion and auto-posts to Meta (PAUSED campaign).

DO $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT' LIMIT 1;

  -- Remove existing schedule if present
  PERFORM cron.unschedule('dwa-ad-factory-weekly')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'dwa-ad-factory-weekly'
    );

  PERFORM cron.schedule(
    'dwa-ad-factory-weekly',
    '0 4 * * 1',  -- Every Monday at 4am UTC
    format(
      $cmd$
      SELECT net.http_post(
        url := %L || '/functions/v1/dwa-ad-factory',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || %L
        ),
        body := '{"trigger":"cron"}'::jsonb
      );
      $cmd$,
      v_url, v_key
    )
  );
END $$;

-- Verify
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'dwa-ad-factory-weekly';
