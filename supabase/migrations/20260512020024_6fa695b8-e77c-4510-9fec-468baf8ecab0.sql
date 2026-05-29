DO $$
DECLARE
  v_hdr text;
BEGIN
  v_hdr := format('{"Content-Type":"application/json","Authorization":"Bearer %s"}',
    'eyJ.REDACTED.JWT');

  PERFORM public.safe_cron_schedule(
    'carealert-monthly-report',
    '0 13 1 * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/carealert-monthly-report', v_hdr)
  );
END $$;