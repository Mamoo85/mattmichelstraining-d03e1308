-- Demand Radar signals table (mirror shape of industry_pulse_signals)
CREATE TABLE IF NOT EXISTS public.demand_radar_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT,
  location TEXT,
  county TEXT,
  zip TEXT,
  vertical TEXT,
  signal_type TEXT,
  industry TEXT,
  expansion_type TEXT,
  hiring_count INTEGER,
  predicted_needs TEXT[],
  confidence INTEGER DEFAULT 5,
  recommended_pitch TEXT,
  source_urls TEXT[],
  cross_referenced BOOLEAN DEFAULT false,
  detected_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.demand_radar_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access demand_radar_signals"
  ON public.demand_radar_signals FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "admins can read demand_radar_signals"
  ON public.demand_radar_signals FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_demand_radar_detected_at ON public.demand_radar_signals(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_demand_radar_vertical ON public.demand_radar_signals(vertical);
CREATE INDEX IF NOT EXISTS idx_demand_radar_signal_type ON public.demand_radar_signals(signal_type);