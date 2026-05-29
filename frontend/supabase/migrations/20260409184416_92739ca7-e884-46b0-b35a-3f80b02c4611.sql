
-- Add new columns for enhanced AI extraction
ALTER TABLE public.outreach_leads
  ADD COLUMN IF NOT EXISTS drip_campaign_status jsonb DEFAULT '{"current_stage": "0_New_Extracted_Lead", "email_opened": false, "last_engagement_timestamp": null}'::jsonb,
  ADD COLUMN IF NOT EXISTS lead_score_indicators text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS validated_email text,
  ADD COLUMN IF NOT EXISTS company_name text;

-- Add unique constraint on email (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'outreach_leads_email_unique'
    AND conrelid = 'public.outreach_leads'::regclass
  ) THEN
    -- First, clean up any existing duplicates by keeping only the latest
    DELETE FROM public.outreach_leads a
    USING public.outreach_leads b
    WHERE a.email IS NOT NULL
      AND a.email = b.email
      AND a.created_at < b.created_at;

    ALTER TABLE public.outreach_leads
      ADD CONSTRAINT outreach_leads_email_unique UNIQUE (email);
  END IF;
END $$;

-- Index on drip_campaign_status for filtering
CREATE INDEX IF NOT EXISTS idx_outreach_leads_drip_status
  ON public.outreach_leads USING gin (drip_campaign_status);

-- Index on validated_email for dedup lookups
CREATE INDEX IF NOT EXISTS idx_outreach_leads_validated_email
  ON public.outreach_leads (validated_email);
