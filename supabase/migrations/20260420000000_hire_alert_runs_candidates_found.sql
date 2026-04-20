-- Add source_breakdown JSONB column to hire_alert_runs for per-source zero-result tracking.
-- candidates_found already exists from prior migrations (20260410300000, 20260415030000, etc.)
ALTER TABLE public.hire_alert_runs
  ADD COLUMN IF NOT EXISTS source_breakdown JSONB;
