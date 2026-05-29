-- outreach-leads-enrich: daily 11am ET (15:00 UTC)
-- Runs after channel-prospector-followup (10am) so new leads from overnight
-- are enriched before the afternoon follow-up window.

DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJ.REDACTED.JWT';
  v_hdr text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;

  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  PERFORM cron.unschedule('outreach-leads-enrich-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'outreach-leads-enrich-daily');

  PERFORM cron.schedule(
    'outreach-leads-enrich-daily',
    '0 15 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/outreach-leads-enrich', v_hdr)
  );
END $migration$;
