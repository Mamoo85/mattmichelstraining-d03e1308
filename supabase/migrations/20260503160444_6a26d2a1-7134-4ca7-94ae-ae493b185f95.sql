
CREATE OR REPLACE FUNCTION public.is_aggregator_domain(url text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN url IS NULL OR url = '' THEN false
    ELSE lower(url) ~ '(indeed\.com|ziprecruiter\.com|glassdoor\.com|linkedin\.com|monster\.com|simplyhired\.com|careerbuilder\.com|dice\.com|snagajob\.com|jobs2careers\.com|jooble\.org|talent\.com|nexxt\.com|theladders\.com|adzuna\.com|jobcase\.com|lensa\.com|workable\.com|greenhouse\.io|lever\.co|smartrecruiters\.com|bamboohr\.com|paycor\.com|adp\.com|paychex\.com|ultipro\.com|workday\.com|taleo\.net|icims\.com|jobvite\.com|brassring\.com|yelp\.com|bbb\.org|angi\.com|angieslist\.com|homeadvisor\.com|thumbtack\.com|porch\.com|houzz\.com|nextdoor\.com|facebook\.com|twitter\.com|instagram\.com|youtube\.com|tiktok\.com|pinterest\.com|reddit\.com|wikipedia\.org|amazon\.com|ebay\.com|craigslist\.org|manta\.com|yellowpages\.com|whitepages\.com|superpages\.com|merchantcircle\.com|chamberofcommerce\.com|dnb\.com|zoominfo\.com|apollo\.io|hunter\.io|rocketreach\.co|crunchbase\.com)'
  END;
$$;

DO $$ BEGIN ALTER TABLE public.contractor_outreach_prospects ADD COLUMN IF NOT EXISTS enrichment_reset_at timestamptz; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS enrichment_reset_at timestamptz; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.techalert_prospect_targets ADD COLUMN IF NOT EXISTS enrichment_reset_at timestamptz; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  UPDATE public.contractor_outreach_prospects SET website=NULL, enriched_at=NULL, enrichment_reset_at=now() WHERE public.is_aggregator_domain(website);
  UPDATE public.contractor_outreach_prospects SET enriched_at=NULL, enrichment_reset_at=now() WHERE enriched_at IS NOT NULL AND (owner_email IS NULL OR owner_email='') AND enriched_at < now() - interval '1 day';
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  UPDATE public.outreach_leads SET website=NULL, enriched_at=NULL, enrichment_reset_at=now() WHERE public.is_aggregator_domain(website);
  UPDATE public.outreach_leads SET enriched_at=NULL, enrichment_reset_at=now() WHERE enriched_at IS NOT NULL AND (owner_email IS NULL OR owner_email='') AND enriched_at < now() - interval '1 day';
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  UPDATE public.techalert_prospect_targets SET website=NULL, enriched_at=NULL, enrichment_reset_at=now() WHERE public.is_aggregator_domain(website);
  UPDATE public.techalert_prospect_targets SET enriched_at=NULL, enrichment_reset_at=now() WHERE enriched_at IS NOT NULL AND (owner_email IS NULL OR owner_email='') AND enriched_at < now() - interval '1 day';
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN UPDATE public.hire_alert_candidates SET company_domain=NULL WHERE public.is_aggregator_domain(company_domain); EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;
DO $$ BEGIN UPDATE public.marketplace_prospects SET website=NULL WHERE public.is_aggregator_domain(website); EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;
