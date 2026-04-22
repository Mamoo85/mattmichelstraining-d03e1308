-- Add audience_type column (nullable, indexed) to postcard_prospects
ALTER TABLE public.postcard_prospects
  ADD COLUMN IF NOT EXISTS audience_type TEXT;

CREATE INDEX IF NOT EXISTS idx_postcard_prospects_audience_county
  ON public.postcard_prospects (audience_type, county)
  WHERE postcard_sent_at IS NULL;

-- Backfill from source
UPDATE public.postcard_prospects
SET audience_type = CASE
  WHEN source = 'cms_nursing_home' THEN 'nursing-home'
  WHEN source IN ('lara_bpl', 'lara_accela', 'lara_business') THEN 'contractor'
  WHEN source = 'healthcare_staffing' THEN 'healthcare-agency'
  WHEN source = 'trades_staffing' THEN 'trades-agency'
  WHEN source = 'supply_house' THEN 'supply-house'
  ELSE audience_type
END
WHERE audience_type IS NULL;