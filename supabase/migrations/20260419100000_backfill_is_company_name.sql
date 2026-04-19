-- Backfill is_company_name = true on existing garbage rows in hire_alert_candidates.
-- These slipped through before the isPersonName heuristic was hardened.
-- Patterns mirror the COMPANY_NAME_SIGNALS + looksLikeCompany() logic in hire-alert-scanner.

UPDATE public.hire_alert_candidates
SET is_company_name = true
WHERE is_company_name IS DISTINCT FROM true
  AND (
    -- Legal entity markers
    full_name ~* '\y(inc|llc|corp|ltd|limited|dba|d/b/a|holdings)\y'
    -- Business type words
    OR full_name ~* '\y(contractors?|services?|solutions|group|enterprises|associates|systems|industries|construction|plumbing|hvac|mechanical|electric(al)?|heating|cooling|realty)\y'
    -- Ownership words
    OR full_name ~* '\y(pros|brothers|bros|and sons|& sons|& son|and son)\y'
    -- Observed garbage names
    OR full_name ~* '\y(pipey|bargain|comfort zone|rocket pros|reliable|premier|advantage|quality|professional|specialist|expert)\y'
    -- Single word entries (can't be a person's full name)
    OR full_name NOT LIKE '% %'
    -- ALL CAPS names longer than 8 chars (company abbreviations: "HVAC SOLUTIONS", "ABC CORP")
    OR (length(full_name) > 8 AND full_name = upper(full_name) AND full_name ~ '[A-Z]{3}')
    -- Names with digits (phone numbers, addresses stored as names)
    OR full_name ~ '\d{5,}'
    -- Honorific + single word (Mr Pipey, Mrs Smith Co)
    OR full_name ~* '^(mr|mrs|ms|dr)\.?\s+\S+$'
  );

-- Log how many were flagged
DO $$
DECLARE
  cnt integer;
BEGIN
  SELECT count(*) INTO cnt FROM public.hire_alert_candidates WHERE is_company_name = true;
  RAISE NOTICE 'is_company_name=true rows after backfill: %', cnt;
END $$;
