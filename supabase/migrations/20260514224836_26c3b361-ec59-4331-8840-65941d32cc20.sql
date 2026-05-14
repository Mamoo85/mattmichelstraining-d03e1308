
-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 51 — Daily digest reliability + AmeriSteel hub tracking
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) trial_hub_events — UTM/click/CTA tracking for trial hub emails
CREATE TABLE IF NOT EXISTS public.trial_hub_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_token text NOT NULL,
  email text,
  product_key text,
  event_type text NOT NULL CHECK (event_type IN (
    'hub_view','tile_open','email_click','cta_step_completed','setup_progress'
  )),
  cta_step text,
  utm jsonb,
  metadata jsonb,
  user_agent text,
  referrer text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_hub_events_bundle_token ON public.trial_hub_events(bundle_token);
CREATE INDEX IF NOT EXISTS idx_trial_hub_events_event_type ON public.trial_hub_events(event_type);
CREATE INDEX IF NOT EXISTS idx_trial_hub_events_bundle_product ON public.trial_hub_events(bundle_token, product_key);
CREATE INDEX IF NOT EXISTS idx_trial_hub_events_created_at ON public.trial_hub_events(created_at DESC);

ALTER TABLE public.trial_hub_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role bypass" ON public.trial_hub_events;
CREATE POLICY "service_role bypass" ON public.trial_hub_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anon CANNOT insert directly — must go through trial-hub-track edge function.
DROP POLICY IF EXISTS "no_anon_insert" ON public.trial_hub_events;
CREATE POLICY "no_anon_insert" ON public.trial_hub_events
  FOR INSERT TO anon WITH CHECK (false);

-- 2) Reschedule mortgage-radar-am-digest crons so they run AFTER scanner finishes.
-- Scanner cron runs at 11:00 UTC and historically takes ~2.5 hours
-- (heartbeat ended 13:15 UTC today). Old digest at 11:30/11:35 fired before
-- today's leads landed → digests_sent: 0 across all 3 active clients.
-- Move primary digest to 14:00 UTC (10am ET) and retry to 14:30 UTC.
DO $cron$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw';
  v_hdr text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;
  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  PERFORM cron.unschedule('mortgage-radar-am-digest') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mortgage-radar-am-digest');
  PERFORM cron.schedule('mortgage-radar-am-digest', '0 14 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/mortgage-radar-am-digest', v_hdr));

  PERFORM cron.unschedule('mortgage-radar-am-digest-retry') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mortgage-radar-am-digest-retry');
  PERFORM cron.schedule('mortgage-radar-am-digest-retry', '30 14 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/mortgage-radar-am-digest', v_hdr));

  -- 3) site-radar-weekly-digest — Monday 13:00 UTC (9am ET) + retry at 13:30
  PERFORM cron.unschedule('site-radar-weekly-digest-monday') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'site-radar-weekly-digest-monday');
  PERFORM cron.schedule('site-radar-weekly-digest-monday', '0 13 * * 1',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/site-radar-weekly-digest', v_hdr));

  PERFORM cron.unschedule('site-radar-weekly-digest-retry') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'site-radar-weekly-digest-retry');
  PERFORM cron.schedule('site-radar-weekly-digest-retry', '30 13 * * 1',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/site-radar-weekly-digest', v_hdr));

  -- 4) techalert-weekly-digest already runs Mon 13:00 UTC — add a retry.
  PERFORM cron.unschedule('techalert-weekly-digest-retry') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'techalert-weekly-digest-retry');
  PERFORM cron.schedule('techalert-weekly-digest-retry', '45 13 * * 1',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/techalert-weekly-digest', v_hdr));
END $cron$;
