-- Add lead_score and breach_count columns to prospect_pipeline
ALTER TABLE public.prospect_pipeline ADD COLUMN IF NOT EXISTS lead_score INTEGER;
ALTER TABLE public.prospect_pipeline ADD COLUMN IF NOT EXISTS breach_count INTEGER;

-- Add index for lead_score sorting
CREATE INDEX IF NOT EXISTS idx_prospect_pipeline_lead_score ON public.prospect_pipeline (lead_score DESC NULLS LAST);