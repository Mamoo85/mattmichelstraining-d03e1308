-- Migration 1: talent-seed-bulk nightly cron (approved pattern: hardcoded URL + inline anon JWT)
DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw';
  v_hdr text;
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;

  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;

  PERFORM cron.unschedule('talent-seed-bulk-nightly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'talent-seed-bulk-nightly');

  PERFORM cron.schedule(
    'talent-seed-bulk-nightly',
    '30 2 * * *',
    format(
      $job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{"limit_per_state":200}'::jsonb);$job$,
      v_url || '/functions/v1/talent-seed-bulk',
      v_hdr
    )
  );
END $migration$;

-- Migration 2: talent_outreach_states table
CREATE TABLE IF NOT EXISTS public.talent_outreach_states (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state               text NOT NULL,
  trade_group         text NOT NULL,
  candidate_count     int  NOT NULL DEFAULT 0,
  threshold           int  NOT NULL DEFAULT 50,
  outreach_active     bool NOT NULL DEFAULT false,
  threshold_met_at    timestamptz,
  last_hunt_at        timestamptz,
  last_count_at       timestamptz,
  prospects_added     int  NOT NULL DEFAULT 0,
  emails_sent         int  NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_talent_outreach_states
  ON public.talent_outreach_states (state, trade_group);

CREATE INDEX IF NOT EXISTS idx_talent_outreach_states_active
  ON public.talent_outreach_states (outreach_active, last_hunt_at)
  WHERE outreach_active = true;

ALTER TABLE public.talent_outreach_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_talent_outreach_states" ON public.talent_outreach_states;
CREATE POLICY "service_role_all_talent_outreach_states"
  ON public.talent_outreach_states FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_read_talent_outreach_states" ON public.talent_outreach_states;
CREATE POLICY "admin_read_talent_outreach_states"
  ON public.talent_outreach_states FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));