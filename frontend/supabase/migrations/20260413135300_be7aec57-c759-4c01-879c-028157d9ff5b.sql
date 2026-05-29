
-- Add columns the scanner already references but that don't exist
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS availability_score integer;
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS score_reason text;
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS license_expiry text;
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS zip text;
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS first_seen_at timestamptz DEFAULT now();
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();

-- Add deep enrichment columns
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS facebook_url text;
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS current_employer text;
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS current_title text;
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS years_experience integer;
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS qualifications_summary text;
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS hiring_recommendation text;
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS social_profiles jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS enrichment_status text DEFAULT 'pending';
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS enriched_at timestamptz;

-- Backfill full_name from name for existing rows
UPDATE public.hire_alert_candidates SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;

-- Index for enrichment cron queries
CREATE INDEX IF NOT EXISTS idx_hire_REDACTED ON public.hire_alert_candidates (enrichment_status) WHERE enrichment_status = 'pending';
