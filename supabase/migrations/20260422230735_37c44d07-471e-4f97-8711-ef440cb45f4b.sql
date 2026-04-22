ALTER TABLE public.prospect_pool
  ADD COLUMN IF NOT EXISTS google_rating numeric,
  ADD COLUMN IF NOT EXISTS review_count int,
  ADD COLUMN IF NOT EXISTS phone_carrier_type text,
  ADD COLUMN IF NOT EXISTS has_breach boolean,
  ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_status text;

CREATE INDEX IF NOT EXISTS idx_prospect_pool_enrichment_due
  ON public.prospect_pool (last_enriched_at NULLS FIRST)
  WHERE enrichment_status IS DISTINCT FROM 'dead_end';