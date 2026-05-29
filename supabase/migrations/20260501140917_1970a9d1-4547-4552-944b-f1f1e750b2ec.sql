DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJ.REDACTED.JWT';
  v_hdr text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;

  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  -- Weekly compliance audit: Monday 12:00 UTC = 7am ET
  PERFORM cron.unschedule('dwa-v4-compliance-audit-weekly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dwa-v4-compliance-audit-weekly');
  PERFORM cron.schedule(
    'dwa-v4-compliance-audit-weekly',
    '0 12 * * 1',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/dwa-v4-compliance-audit', v_hdr)
  );

  -- Quarterly QBR generator: 1st of Jan/Apr/Jul/Oct at 11:00 UTC = 6am ET
  PERFORM cron.unschedule('dwa-v4-qbr-quarterly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dwa-v4-qbr-quarterly');
  PERFORM cron.schedule(
    'dwa-v4-qbr-quarterly',
    '0 11 1 1,4,7,10 *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/dwa-v4-qbr-generator', v_hdr)
  );
END $migration$;
