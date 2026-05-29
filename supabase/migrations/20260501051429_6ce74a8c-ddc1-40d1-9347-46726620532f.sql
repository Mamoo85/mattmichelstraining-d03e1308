-- Tracking columns for autopilot idempotency
ALTER TABLE public.dwa_contractor_referrals
  ADD COLUMN IF NOT EXISTS nudged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.field_crm_clients
  ADD COLUMN IF NOT EXISTS eway_followup_sent_at TIMESTAMPTZ;

-- Schedule daily autopilot sweep (9am ET = 13:00 UTC)
DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJ.REDACTED.JWT';
  v_hdr text;
  v_cmd text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;

  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;
  v_cmd := format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
    v_url || '/functions/v1/dwa-autopilot-sweep', v_hdr);

  -- Use safe wrapper if available, else fall back to raw cron.schedule
  BEGIN
    PERFORM public.safe_cron_schedule('dwa-autopilot-sweep-daily', '0 13 * * *', v_cmd);
  EXCEPTION WHEN undefined_function THEN
    PERFORM cron.unschedule('dwa-autopilot-sweep-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dwa-autopilot-sweep-daily');
    PERFORM cron.schedule('dwa-autopilot-sweep-daily', '0 13 * * *', v_cmd);
  END;
END $migration$;