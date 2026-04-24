-- Schedule marketplace-saved-search-notifier every 15 minutes
DO $$
DECLARE
  v_url text;
  v_anon text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_anon FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;
  IF v_url IS NULL OR v_anon IS NULL THEN
    RAISE NOTICE 'vault secrets missing — skipping cron schedule';
    RETURN;
  END IF;

  PERFORM cron.unschedule('marketplace-saved-search-notifier-15min')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'marketplace-saved-search-notifier-15min');

  PERFORM cron.schedule(
    'marketplace-saved-search-notifier-15min',
    '*/15 * * * *',
    format(
      $sql$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L),
        body := '{}'::jsonb
      );
      $sql$,
      v_url || '/functions/v1/marketplace-saved-search-notifier',
      v_anon
    )
  );
END $$;