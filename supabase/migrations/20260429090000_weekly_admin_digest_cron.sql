-- weekly-admin-digest: every Monday 8am ET (13:00 UTC)
-- Sends Matt a single SMS with the week's pipeline numbers across every product.

DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJ.REDACTED.JWT';
  v_hdr text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;

  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  PERFORM cron.unschedule('weekly-admin-digest-monday')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-admin-digest-monday');

  PERFORM cron.schedule(
    'weekly-admin-digest-monday',
    '0 13 * * 1',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/weekly-admin-digest', v_hdr)
  );
END $migration$;
