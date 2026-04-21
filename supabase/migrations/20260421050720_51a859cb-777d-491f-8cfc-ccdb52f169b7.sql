-- Schedule dwa-ad-optimizer every 6h and contractor-seo-content weekly (Mondays 9am ET = 14:00 UTC)
DO $$
DECLARE
  supa_url text;
  service_key text;
BEGIN
  SELECT decrypted_secret INTO supa_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF supa_url IS NULL OR service_key IS NULL THEN
    RAISE NOTICE 'Vault secrets missing — skipping cron schedule. Add manually later.';
    RETURN;
  END IF;

  -- remove any prior versions
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname IN ('dwa-ad-optimizer-6h', 'contractor-seo-content-weekly');

  PERFORM cron.schedule(
    'dwa-ad-optimizer-6h',
    '0 */6 * * *',
    format($f$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L),
        body := '{}'::jsonb
      );
    $f$, supa_url || '/functions/v1/dwa-ad-optimizer', service_key)
  );

  PERFORM cron.schedule(
    'contractor-seo-content-weekly',
    '0 14 * * 1',
    format($f$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L),
        body := '{}'::jsonb
      );
    $f$, supa_url || '/functions/v1/contractor-seo-content', service_key)
  );
END $$;