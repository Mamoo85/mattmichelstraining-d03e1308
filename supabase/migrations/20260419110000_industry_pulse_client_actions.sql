-- Track client actions on Demand Radar signals (contacted / won / lost / passed)
-- Used to power the ROI ledger and pipeline view in MyIndustryPulse dashboard.
CREATE TABLE IF NOT EXISTS public.industry_pulse_client_actions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid NOT NULL REFERENCES public.industry_pulse_clients(id) ON DELETE CASCADE,
  signal_id     uuid NOT NULL,
  company_name  text NOT NULL,
  action        text NOT NULL CHECK (action IN ('contacted', 'won', 'lost', 'passed')),
  deal_value    numeric(10,2) DEFAULT 0,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, signal_id)  -- one action state per client per signal (upsert-friendly)
);

ALTER TABLE public.industry_pulse_client_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full" ON public.industry_pulse_client_actions
  FOR ALL USING (auth.role() = 'service_role');
