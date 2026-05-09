-- talent_outreach_states: tracks which (state, trade_group) combos have crossed
-- the candidate threshold and are cleared for cold email outreach.
-- Populated by talent-outreach-threshold-check after each nightly seed run.

CREATE TABLE IF NOT EXISTS public.talent_outreach_states (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state               text NOT NULL,        -- 2-letter abbreviation: "MI", "OH", "TX"
  trade_group         text NOT NULL,        -- "nursing" | "cdl_trucking"
  candidate_count     int  NOT NULL DEFAULT 0,
  threshold           int  NOT NULL DEFAULT 50,
  outreach_active     bool NOT NULL DEFAULT false,
  threshold_met_at    timestamptz,          -- when count first crossed threshold
  last_hunt_at        timestamptz,          -- last time prospect hunter ran for this state
  last_count_at       timestamptz,          -- last time we recounted candidates
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

CREATE POLICY "service_role_all_talent_outreach_states"
  ON public.talent_outreach_states FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_read_talent_outreach_states"
  ON public.talent_outreach_states FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
