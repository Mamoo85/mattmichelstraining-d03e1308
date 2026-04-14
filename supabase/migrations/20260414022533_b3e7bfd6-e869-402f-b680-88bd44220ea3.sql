-- Fix missing client_action column + add claim system to hire_alert_client_candidates
ALTER TABLE public.hire_alert_client_candidates
  ADD COLUMN IF NOT EXISTS client_action text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz;

-- Index for fast claim lookups
CREATE INDEX IF NOT EXISTS idx_hacc_candidate_claim
  ON public.hire_alert_client_candidates (candidate_id, claimed_at, claim_expires_at)
  WHERE claimed_at IS NOT NULL;

-- Create industry_pulse_signals table
CREATE TABLE IF NOT EXISTS public.industry_pulse_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  location text,
  industry text,
  hiring_roles text[] DEFAULT '{}',
  hiring_count int DEFAULT 0,
  predicted_needs text[] DEFAULT '{}',
  confidence int DEFAULT 0,
  recommended_pitch text,
  source_urls text[] DEFAULT '{}',
  cross_referenced boolean DEFAULT false,
  detected_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- RLS: service_role only (admin data, not user-facing)
ALTER TABLE public.industry_pulse_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on industry_pulse_signals"
  ON public.industry_pulse_signals
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_ips_confidence ON public.industry_pulse_signals (confidence DESC);
CREATE INDEX IF NOT EXISTS idx_ips_industry ON public.industry_pulse_signals (industry);
CREATE INDEX IF NOT EXISTS idx_ips_cross_ref ON public.industry_pulse_signals (cross_referenced) WHERE cross_referenced = true;