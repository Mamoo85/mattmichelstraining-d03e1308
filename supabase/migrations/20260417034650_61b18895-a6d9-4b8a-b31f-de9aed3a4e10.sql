-- Schedule The Wire morning digest at 7am ET (11:00 UTC) daily
DO $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE 'SUPABASE_URL or SERVICE_ROLE_KEY not in vault — cron not scheduled. Schedule manually after vault populated.';
    RETURN;
  END IF;

  -- Remove existing if present
  PERFORM cron.unschedule('wire-morning-digest') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wire-morning-digest');

  PERFORM cron.schedule(
    'wire-morning-digest',
    '0 11 * * *',
    format($cron$
      SELECT net.http_post(
        url:=%L,
        headers:=%L::jsonb,
        body:='{"trigger":"cron"}'::jsonb
      ) AS request_id;
    $cron$, v_url || '/functions/v1/wire-morning-digest',
       '{"Content-Type":"application/json","Authorization":"Bearer ' || v_key || '"}')
  );
END $$;