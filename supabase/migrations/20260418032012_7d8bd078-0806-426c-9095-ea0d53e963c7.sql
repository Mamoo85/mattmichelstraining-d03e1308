-- Phase 3: Resumable checkpoints
CREATE TABLE IF NOT EXISTS public.hire_alert_scanner_checkpoints (
  source TEXT PRIMARY KEY,
  last_completed_at TIMESTAMPTZ,
  last_started_at TIMESTAMPTZ,
  last_cursor JSONB DEFAULT '{}'::jsonb,
  last_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle',
  error_message TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hire_alert_scanner_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_checkpoints" ON public.hire_alert_scanner_checkpoints
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Phase 4: Enrichment log
CREATE TABLE IF NOT EXISTS public.candidate_enrichment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.hire_alert_candidates(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  source TEXT NOT NULL,
  hit_fields TEXT[] DEFAULT '{}',
  cost_estimate NUMERIC(10,4) DEFAULT 0,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enrichment_log_candidate ON public.candidate_enrichment_log(candidate_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_log_stage ON public.candidate_enrichment_log(stage, source);
ALTER TABLE public.candidate_enrichment_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_enrich_log" ON public.candidate_enrichment_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_read_enrich_log" ON public.candidate_enrichment_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Phase 1: Business prospects (separate from candidates)
CREATE TABLE IF NOT EXISTS public.techalert_business_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  trade TEXT,
  city TEXT,
  state TEXT DEFAULT 'MI',
  zip TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  source TEXT NOT NULL,
  raw_data JSONB,
  status TEXT DEFAULT 'new',
  outreach_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_name, city)
);
ALTER TABLE public.techalert_business_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_biz_prospects" ON public.techalert_business_prospects
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_read_biz_prospects" ON public.techalert_business_prospects
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Phase 1: Backfill garbage rows
CREATE INDEX IF NOT EXISTS idx_candidates_is_company ON public.hire_alert_candidates(is_company_name) WHERE is_company_name = true;

-- Mark obvious business-name garbage as is_company_name=true
UPDATE public.hire_alert_candidates
SET is_company_name = true
WHERE is_company_name IS NOT TRUE
  AND (
    -- Phone-number-as-name
    full_name ~ '^[\(\d\s\)\-\+\.]+'
    OR full_name ILIKE 'Phone:%'
    -- Trade business words
    OR full_name ~* '\m(plumbing|hvac|heating|cooling|electric|electrical|mechanical|services?|repair|company|contractors?|solutions?|appliance|supply|maintenance|properties|realty|investments|enterprises|industries|construction|llc|inc|corp|co\.|holdings|group|associates|systems|management)\M'
    -- Common business-pattern names from the audit
    OR full_name ILIKE 'Mr Pipey%'
    OR full_name ILIKE 'Rocket Pros%'
    OR full_name ILIKE 'Comfort Zone%'
    OR full_name ILIKE 'Marvin and Son%'
    OR full_name ILIKE 'A1 Bargain%'
    OR full_name ILIKE 'Drewski Handyman%'
    OR full_name ILIKE 'Plumb Pros%'
    OR full_name ILIKE 'All American%'
    OR full_name ILIKE 'Friendly Pro%'
    OR full_name ILIKE 'Keitz%'
    OR full_name ILIKE 'Downriver%'
    OR full_name ILIKE '%Climate Control%'
    -- Ends in company word
    OR full_name ~* '\s+(and|son|sons|brothers|bros|llc|inc|corp|pros|zone)\s*$'
    -- ALL CAPS company names
    OR (full_name = upper(full_name) AND length(full_name) > 8 AND full_name !~ '[a-z]')
    -- Source = yelp/phcc/permits AND no real first+last (these sources should never produce candidates)
    OR (source IN ('yelp', 'phcc', 'building_permits') AND full_name !~ '^[A-Z][a-z]+\s+[A-Z][a-z]+$')
  );