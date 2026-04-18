-- Add phone type verification columns to hire_alert_candidates.
-- Populated by the verify-candidate-phones edge function (one-shot admin call).

ALTER TABLE public.hire_alert_candidates
  ADD COLUMN IF NOT EXISTS phone_type text,         -- 'mobile' | 'landline' | 'voip' | 'unknown'
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;  -- null = not yet checked

COMMENT ON COLUMN public.hire_alert_candidates.phone_type IS 'Twilio Lookup line type: mobile, landline, voip, unknown';
COMMENT ON COLUMN public.hire_alert_candidates.phone_verified_at IS 'Timestamp when Twilio Lookup was last run on this candidate';
