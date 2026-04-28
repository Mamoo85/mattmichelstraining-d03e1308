DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw';
  v_hdr text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;

  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  -- Matrix walker — every 30 minutes
  PERFORM public.safe_cron_schedule(
    'enrichment-matrix-walker-30m',
    '*/30 * * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/enrichment-matrix-walker', v_hdr)
  );

  -- Alert evaluator — every 5 minutes
  PERFORM public.safe_cron_schedule(
    'outreach-alert-evaluator-5m',
    '*/5 * * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/outreach-alert-evaluator', v_hdr)
  );

  -- Nightly E2E canary — 4am ET (8am UTC)
  PERFORM public.safe_cron_schedule(
    'enrichment-e2e-verify-nightly',
    '0 8 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/enrichment-e2e-verify', v_hdr)
  );

  -- Nightly DLQ backfill — 3am ET (7am UTC), execute mode
  PERFORM public.safe_cron_schedule(
    'enrichment-backfill-nightly',
    '0 7 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);$job$,
      v_url || '/functions/v1/contractor-outreach-enrich-backfill', v_hdr,
      '{"mode":"execute","limit":100,"source":"dlq"}')
  );
END $migration$;