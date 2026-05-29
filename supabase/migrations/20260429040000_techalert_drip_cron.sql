-- TechAlert follow-up drip cron: runs twice daily at 9am + 2pm ET

DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJ.REDACTED.JWT';
  v_hdr text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;

  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  -- 9am ET = 13:00 UTC
  PERFORM cron.unschedule('techalert-drip-morning')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'techalert-drip-morning');

  PERFORM cron.schedule(
    'techalert-drip-morning',
    '0 13 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/techalert-followup-drip', v_hdr)
  );

  -- 2pm ET = 18:00 UTC
  PERFORM cron.unschedule('techalert-drip-afternoon')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'techalert-drip-afternoon');

  PERFORM cron.schedule(
    'techalert-drip-afternoon',
    '0 18 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/techalert-followup-drip', v_hdr)
  );

END $migration$;
