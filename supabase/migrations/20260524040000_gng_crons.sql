-- GNG cron jobs on secondary project:
--   etsy-listing-sync   — daily 6am UTC  (sync Etsy listings → etsy_listings table)
--   etsy-listing-renewer — daily 7am UTC (auto-renew expiring listings)
--   etsy-listing-translator — weekly Sunday 3am UTC (translate top 20 to de/fr/es)

DO $migration$
DECLARE
  v_url text := 'https://zmyczlfuufhngzovkjdh.supabase.co';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT';
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'vault key missing'; END IF;

  -- etsy-listing-sync: daily 6am UTC
  PERFORM cron.unschedule('etsy-listing-sync')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'etsy-listing-sync');
  PERFORM cron.schedule(
    'etsy-listing-sync',
    '0 6 * * *',
    format(
      $job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/etsy-listing-sync',
      json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key)::text
    )
  );

  -- etsy-listing-renewer: daily 7am UTC
  PERFORM cron.unschedule('etsy-listing-renewer')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'etsy-listing-renewer');
  PERFORM cron.schedule(
    'etsy-listing-renewer',
    '0 7 * * *',
    format(
      $job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/etsy-listing-renewer',
      json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key)::text
    )
  );

  -- etsy-listing-translator: weekly Sunday 3am UTC
  PERFORM cron.unschedule('etsy-listing-translator')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'etsy-listing-translator');
  PERFORM cron.schedule(
    'etsy-listing-translator',
    '0 3 * * 0',
    format(
      $job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/etsy-listing-translator',
      json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key)::text
    )
  );

END $migration$;
