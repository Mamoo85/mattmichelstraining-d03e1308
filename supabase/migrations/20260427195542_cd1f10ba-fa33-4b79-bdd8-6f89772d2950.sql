ALTER TABLE public.hire_alert_candidates
  ADD COLUMN IF NOT EXISTS license_number TEXT,
  ADD COLUMN IF NOT EXISTS license_state TEXT DEFAULT 'MI',
  ADD COLUMN IF NOT EXISTS nursys_enrolled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nursys_enrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nursys_last_status TEXT,
  ADD COLUMN IF NOT EXISTS nursys_last_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_hire_alert_candidates_license
  ON public.hire_alert_candidates (license_state, license_number)
  WHERE license_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hire_alert_candidates_nursys_enrolled
  ON public.hire_alert_candidates (nursys_enrolled)
  WHERE nursys_enrolled = true;