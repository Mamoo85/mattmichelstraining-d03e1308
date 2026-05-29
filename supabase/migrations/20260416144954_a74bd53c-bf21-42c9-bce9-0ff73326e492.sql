
ALTER TABLE public.hire_REDACTED 
  ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'alerted',
  ADD COLUMN IF NOT EXISTS hired_revenue_estimate integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interview_scheduled_at timestamptz;

COMMENT ON COLUMN public.hire_REDACTED.pipeline_stage IS 'Tracks candidate through funnel: alerted → viewed → contacted → interviewed → hired';
COMMENT ON COLUMN public.hire_REDACTED.hired_revenue_estimate IS 'Estimated annual revenue this hire generates, in dollars';
