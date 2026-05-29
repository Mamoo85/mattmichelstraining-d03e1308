-- TechAlert automated pipeline crons:
--   6am ET (10:00 UTC) — hunter already scheduled in 20260421125842
--   7am ET (11:00 UTC) — enrich: Apollo owner lookup on new prospects
--   8am ET (12:00 UTC) — outreach: cold email to enriched prospects

DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJ.REDACTED.JWT';
  v_hdr text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;

  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  -- Enrich: 7am ET = 11:00 UTC
  PERFORM cron.unschedule('techalert-enrich-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'techalert-enrich-daily');

  PERFORM cron.schedule(
    'techalert-enrich-daily',
    '0 11 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/techalert-enrich', v_hdr)
  );

  -- Outreach: 8am ET = 12:00 UTC
  PERFORM cron.unschedule('techalert-outreach-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'techalert-outreach-daily');

  PERFORM cron.schedule(
    'techalert-outreach-daily',
    '0 12 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/techalert-outreach', v_hdr)
  );

END $migration$;
