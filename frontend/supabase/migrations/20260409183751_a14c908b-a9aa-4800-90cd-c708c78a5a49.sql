
-- Add enrichment columns to prospect_businesses
ALTER TABLE public.prospect_businesses
  ADD COLUMN IF NOT EXISTS enrichment_source text,
  ADD COLUMN IF NOT EXISTS enrichment_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verified_email boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS decision_maker_name text,
  ADD COLUMN IF NOT EXISTS decision_maker_title text,
  ADD COLUMN IF NOT EXISTS direct_phone text,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_data jsonb DEFAULT '{}'::jsonb;

-- Index for enrichment queries
CREATE INDEX IF NOT EXISTS idx_prospect_businesses_enrichment_status ON public.prospect_businesses (enrichment_status);
CREATE INDEX IF NOT EXISTS idx_prospect_businesses_enrichment_source ON public.prospect_businesses (enrichment_source);
