-- Phase 1.1 + Phase 2 backfill: align hire_alert_runs with what the scanner actually writes,
-- and backfill trade column for legacy rows.

-- 1. Additive columns on hire_alert_runs (don't drop anything)
ALTER TABLE public.hire_alert_runs
  ADD COLUMN IF NOT EXISTS run_at timestamptz,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS new_candidates integer,
  ADD COLUMN IF NOT EXISTS alerts_sent integer,
  ADD COLUMN IF NOT EXISTS errors jsonb;

-- 2. Backfill trade for existing 160 candidates from license_type
UPDATE public.hire_alert_candidates
SET trade = CASE
  WHEN license_type ILIKE '%boiler%' OR license_type ILIKE '%stationary%' THEN 'boiler'
  WHEN license_type ILIKE '%hvac%' OR license_type ILIKE '%refrigeration%' OR license_type ILIKE '%mechanical%' THEN 'hvac'
  WHEN license_type ILIKE '%plumb%' THEN 'plumbing'
  WHEN license_type ILIKE '%electric%' THEN 'electrical'
  WHEN license_type ILIKE '%nurse%' OR license_type ILIKE '%lpn%' OR license_type ILIKE '%rn%' OR license_type ILIKE '%cna%' THEN 'nursing'
  WHEN license_type ILIKE '%home health%' OR license_type ILIKE '%aide%' THEN 'home_health'
  WHEN license_type ILIKE '%nurse practitioner%' THEN 'nurse_practitioner'
  WHEN license_type ILIKE '%weld%' THEN 'welding'
  WHEN license_type IS NOT NULL AND license_type <> '' THEN 'other_trade'
  ELSE NULL
END
WHERE trade IS NULL AND license_type IS NOT NULL;

-- 3. Helpful index for the candidate scorer + enricher batch queries
CREATE INDEX IF NOT EXISTS idx_hac_score_null ON public.hire_alert_candidates(created_at) WHERE score IS NULL;
CREATE INDEX IF NOT EXISTS idx_hac_no_contact ON public.hire_alert_candidates(created_at) WHERE email IS NULL AND phone IS NULL;