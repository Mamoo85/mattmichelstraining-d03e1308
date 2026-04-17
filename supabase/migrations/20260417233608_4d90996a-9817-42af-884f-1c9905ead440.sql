-- Backfill vertical and county on industry_pulse_signals so filtering works
-- Add columns if missing (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='industry_pulse_signals' AND column_name='vertical') THEN
    ALTER TABLE public.industry_pulse_signals ADD COLUMN vertical TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='industry_pulse_signals' AND column_name='county') THEN
    ALTER TABLE public.industry_pulse_signals ADD COLUMN county TEXT;
  END IF;
END $$;

-- Backfill county from location string (e.g. "Royal Oak, MI" → "Oakland")
UPDATE public.industry_pulse_signals
SET county = CASE
  WHEN location ILIKE '%detroit%' OR location ILIKE '%dearborn%' OR location ILIKE '%livonia%' OR location ILIKE '%westland%' OR location ILIKE '%canton%' OR location ILIKE '%plymouth%' OR location ILIKE '%redford%' OR location ILIKE '%taylor%' OR location ILIKE '%romulus%' THEN 'Wayne'
  WHEN location ILIKE '%royal oak%' OR location ILIKE '%troy%' OR location ILIKE '%southfield%' OR location ILIKE '%farmington%' OR location ILIKE '%novi%' OR location ILIKE '%pontiac%' OR location ILIKE '%rochester%' OR location ILIKE '%auburn hills%' OR location ILIKE '%bloomfield%' OR location ILIKE '%birmingham%' OR location ILIKE '%waterford%' THEN 'Oakland'
  WHEN location ILIKE '%warren%' OR location ILIKE '%sterling heights%' OR location ILIKE '%clinton%' OR location ILIKE '%macomb%' OR location ILIKE '%shelby%' OR location ILIKE '%roseville%' OR location ILIKE '%st. clair shores%' OR location ILIKE '%fraser%' OR location ILIKE '%mount clemens%' THEN 'Macomb'
  WHEN location ILIKE '%ann arbor%' OR location ILIKE '%ypsilanti%' OR location ILIKE '%saline%' OR location ILIKE '%dexter%' THEN 'Washtenaw'
  WHEN location ILIKE '%grand rapids%' OR location ILIKE '%wyoming%' OR location ILIKE '%kentwood%' THEN 'Kent'
  WHEN location ILIKE '%lansing%' OR location ILIKE '%east lansing%' THEN 'Ingham'
  WHEN location ILIKE '%flint%' THEN 'Genesee'
  ELSE county
END
WHERE county IS NULL AND location IS NOT NULL;

-- Backfill vertical from hiring_roles array / industry / expansion_type
UPDATE public.industry_pulse_signals
SET vertical = CASE
  WHEN array_to_string(hiring_roles, ',') ILIKE '%electric%' OR industry ILIKE '%electric%' THEN 'electrical_supply'
  WHEN array_to_string(hiring_roles, ',') ILIKE '%hvac%' OR array_to_string(hiring_roles, ',') ILIKE '%boiler%' OR industry ILIKE '%hvac%' OR industry ILIKE '%boiler%' THEN 'hvac_supply'
  WHEN array_to_string(hiring_roles, ',') ILIKE '%plumb%' OR industry ILIKE '%plumb%' THEN 'plumbing_supply'
  WHEN array_to_string(hiring_roles, ',') ILIKE '%roof%' OR industry ILIKE '%roof%' THEN 'roofing_supply'
  WHEN industry ILIKE '%steel%' OR industry ILIKE '%metal%' THEN 'steel'
  WHEN industry ILIKE '%concrete%' OR industry ILIKE '%cement%' THEN 'concrete'
  WHEN industry ILIKE '%lumber%' OR industry ILIKE '%wood%' THEN 'lumber'
  ELSE 'industrial_general'
END
WHERE vertical IS NULL;

-- Index for filter performance
CREATE INDEX IF NOT EXISTS idx_industry_pulse_signals_vertical ON public.industry_pulse_signals(vertical);
CREATE INDEX IF NOT EXISTS idx_industry_pulse_signals_county ON public.industry_pulse_signals(county);
CREATE INDEX IF NOT EXISTS idx_industry_pulse_signals_confidence ON public.industry_pulse_signals(confidence DESC);