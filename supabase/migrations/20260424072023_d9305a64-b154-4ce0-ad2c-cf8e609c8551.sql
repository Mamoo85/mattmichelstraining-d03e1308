DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJ.REDACTED.JWT';
  v_hdr text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;

  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  PERFORM public.safe_cron_schedule(
    'channel-prospector-fax-daily',
    '0 14 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);$job$,
      v_url || '/functions/v1/channel-prospector', v_hdr, '{"channel":"fax"}')
  );

  PERFORM public.safe_cron_schedule(
    'channel-prospector-postcard-weekly',
    '0 15 * * 1',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);$job$,
      v_url || '/functions/v1/channel-prospector', v_hdr, '{"channel":"postcard"}')
  );

  PERFORM public.safe_cron_schedule(
    'channel-prospector-sms-daily',
    '0 17 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);$job$,
      v_url || '/functions/v1/channel-prospector', v_hdr, '{"channel":"sms"}')
  );

  PERFORM public.safe_cron_schedule(
    'postcard-outreach-drip-daily',
    '0 16 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/postcard-outreach-drip', v_hdr)
  );

  PERFORM public.safe_cron_schedule(
    'sms-outreach-drip-daily',
    '0 18 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/sms-outreach-drip', v_hdr)
  );
END $migration$;