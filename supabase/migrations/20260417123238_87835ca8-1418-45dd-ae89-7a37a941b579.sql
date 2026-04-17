-- Batch 2 Radar enhancements

-- DR-7: Confidence threshold per client
ALTER TABLE public.industry_pulse_clients
  ADD COLUMN IF NOT EXISTS confidence_threshold integer NOT NULL DEFAULT 7;

-- DR-10: Vendor-fit input
ALTER TABLE public.industry_pulse_clients
  ADD COLUMN IF NOT EXISTS vendor_fit_input text;

-- TR-9: Agency head-start dispatch tracking
ALTER TABLE public.hire_alert_candidates
  ADD COLUMN IF NOT EXISTS first_eligible_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_dispatched_at timestamptz;

-- LR-8: Bid-up mode flag
ALTER TABLE public.contractor_leads
  ADD COLUMN IF NOT EXISTS bidding_mode boolean NOT NULL DEFAULT false;

-- LR-9: Unreachable attempt tracking on purchases
ALTER TABLE public.contractor_lead_purchases
  ADD COLUMN IF NOT EXISTS unreachable_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

-- GR-10: Growth Radar signals table (SAM.gov + other expansion intel)
CREATE TABLE IF NOT EXISTS public.growth_radar_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,                 -- 'sam_gov' | 'sonar' | 'permit' | 'manual'
  signal_type text NOT NULL,            -- 'gov_contract' | 'expansion' | 'equipment' | 'workforce'
  company_name text NOT NULL,
  county text,
  vertical text,
  value_usd numeric,
  predicted_needs text[],
  recommended_pitch text,
  source_url text,
  confidence integer DEFAULT 5,
  detected_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_growth_radar_signals_detected ON public.growth_radar_signals(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_radar_signals_county ON public.growth_radar_signals(county);

ALTER TABLE public.growth_radar_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read growth_radar_signals"
  ON public.growth_radar_signals FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access growth_radar_signals"
  ON public.growth_radar_signals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');