-- Remove any existing duplicates before adding the constraint (keep newest)
DELETE FROM public.prospect_pipeline
WHERE id NOT IN (
  SELECT DISTINCT ON (business_name, city) id
  FROM public.prospect_pipeline
  ORDER BY business_name, city, created_at DESC NULLS LAST
);

-- Add unique constraint for upsert deduplication
ALTER TABLE public.prospect_pipeline
ADD CONSTRAINT uq_prospect_pipeline_business_city UNIQUE (business_name, city);
