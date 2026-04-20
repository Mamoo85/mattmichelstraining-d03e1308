ALTER TABLE public.industry_pulse_signals
  ADD COLUMN IF NOT EXISTS decision_makers JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS decision_makers_enriched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ips_dm_enriched ON public.industry_pulse_signals (decision_makers_enriched_at)
  WHERE decision_makers_enriched_at IS NOT NULL;