-- Backfill: flag obvious company-name rows that slipped past scrape-time filters
UPDATE public.hire_alert_candidates
SET is_company_name = true
WHERE is_company_name = false
  AND (
    name ~* '\m(llc|inc|corp|company|services?|solutions|group|enterprises|systems|industries|construction|plumbing|hvac|mechanical|electric(al)?|heating|cooling|holdings|realty|pros|bargain|handyman|drain|metro|detroit metro|main drain)\M'
    OR full_name ~* '\m(llc|inc|corp|company|services?|solutions|group|enterprises|systems|industries|construction|plumbing|hvac|mechanical|electric(al)?|heating|cooling|holdings|realty|pros|bargain|handyman|drain|metro|detroit metro|main drain)\M'
  );