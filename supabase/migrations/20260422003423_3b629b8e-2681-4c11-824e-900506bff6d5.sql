-- 1. Add delivery tracking columns to prospect_nudges
ALTER TABLE public.prospect_nudges
  ADD COLUMN IF NOT EXISTS last_nudge_sid text,
  ADD COLUMN IF NOT EXISTS last_nudge_status text,
  ADD COLUMN IF NOT EXISTS last_nudge_error text,
  ADD COLUMN IF NOT EXISTS nudge_retry_count int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_prospect_nudges_last_nudge_sid
  ON public.prospect_nudges(last_nudge_sid)
  WHERE last_nudge_sid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prospect_nudges_retry
  ON public.prospect_nudges(last_nudge_status, nudge_sent_at)
  WHERE last_nudge_status IN ('undelivered', 'failed');

-- 2. Add Twilio delivery columns to system_comms_log if missing
ALTER TABLE public.system_comms_log
  ADD COLUMN IF NOT EXISTS twilio_status text,
  ADD COLUMN IF NOT EXISTS twilio_error_code text;

CREATE INDEX IF NOT EXISTS idx_system_comms_log_provider_id
  ON public.system_comms_log(provider_id)
  WHERE provider_id IS NOT NULL;

-- 3. Cron: prospect-nudge-retry every 30 minutes
DO $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NOT NULL AND v_key IS NOT NULL THEN
    PERFORM cron.unschedule('prospect-nudge-retry-30min')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prospect-nudge-retry-30min');

    PERFORM cron.schedule(
      'prospect-nudge-retry-30min',
      '*/30 * * * *',
      format(
        $job$
        SELECT net.http_post(
          url := %L,
          headers := %L::jsonb,
          body := '{}'::jsonb
        );
        $job$,
        v_url || '/functions/v1/prospect-nudge-retry',
        json_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_key
        )::text
      )
    );
  END IF;
END $$;