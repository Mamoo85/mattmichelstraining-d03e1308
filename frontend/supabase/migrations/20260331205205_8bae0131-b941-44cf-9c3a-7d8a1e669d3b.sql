ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS lead_score integer DEFAULT 0;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS target_service text;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS custom_flaw text;