-- 1. Helper RPC so the watchdog edge function can read net._http_response
--    (the net schema isn't exposed via PostgREST). Returns the most recent
--    response for a given URL since a cutoff.
CREATE OR REPLACE FUNCTION public.get_last_net_response_for_url(
  p_url text,
  p_since timestamptz
)
RETURNS TABLE (
  status_code int,
  error_msg text,
  created timestamptz,
  url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, net
AS $$
  SELECT r.status_code, r.error_msg, r.created, q.url
  FROM net._http_response r
  JOIN net.http_request_queue q ON q.id = r.id
  WHERE q.url = p_url
    AND r.created >= p_since
  ORDER BY r.created DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_last_net_response_for_url(text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_last_net_response_for_url(text, timestamptz) TO service_role;

-- 2. Schedule the watchdog hourly via the safe wrapper (rejects NULL urls/Bearer at deploy time)
DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJ.REDACTED.JWT';
  v_hdr text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;

  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  -- Use safe wrapper if available; otherwise fall back to raw cron.schedule
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='safe_cron_schedule') THEN
    PERFORM public.safe_cron_schedule(
      'cron-zero-output-watchdog-hourly',
      '15 * * * *',
      format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := jsonb_build_object('trigger','cron'));$job$,
        v_url || '/functions/v1/cron-zero-output-watchdog', v_hdr)
    );
  ELSE
    PERFORM cron.unschedule('cron-zero-output-watchdog-hourly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='cron-zero-output-watchdog-hourly');
    PERFORM cron.schedule(
      'cron-zero-output-watchdog-hourly',
      '15 * * * *',
      format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := jsonb_build_object('trigger','cron'));$job$,
        v_url || '/functions/v1/cron-zero-output-watchdog', v_hdr)
    );
  END IF;
END $migration$;