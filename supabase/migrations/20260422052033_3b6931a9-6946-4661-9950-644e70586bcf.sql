-- 1. Columns for scheduled follow-up nudges
ALTER TABLE public.prospect_nudges
  ADD COLUMN IF NOT EXISTS scheduled_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS follow_up_status TEXT;

CREATE INDEX IF NOT EXISTS idx_prospect_nudges_followup_due
  ON public.prospect_nudges(scheduled_follow_up_at)
  WHERE scheduled_follow_up_at IS NOT NULL
    AND follow_up_sent_at IS NULL;

-- 2. Schedule the runner cron (every 30 min)
DO $$
DECLARE
  v_url   text;
  v_anon  text;
BEGIN
  SELECT decrypted_secret INTO v_url  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL'      LIMIT 1;
  SELECT decrypted_secret INTO v_anon FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

  IF v_url IS NULL OR v_anon IS NULL THEN
    RAISE NOTICE 'Skipping cron schedule — vault secrets not present';
    RETURN;
  END IF;

  PERFORM cron.unschedule('prospect-followup-runner-30min')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prospect-followup-runner-30min');

  PERFORM cron.schedule(
    'prospect-followup-runner-30min',
    '*/30 * * * *',
    format(
      $cron$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
      $cron$,
      v_url || '/functions/v1/prospect-followup-runner',
      json_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' || v_anon
      )::text
    )
  );
END $$;