WITH junk AS (
  SELECT id FROM public.hire_alert_candidates
  WHERE
    full_name ~* '^(first|last|full|middle|user|company|business|trade|email|phone|contact|display|account)\s+name$'
    OR full_name ~* '^(the|our|your|their|his|her|my|a|an|this|that|these|those)\s'
    OR (full_name = upper(full_name) AND full_name ~ '\s' AND length(full_name) > 6)
    OR full_name ~* '\m(trades?|directory|apprenticeship|workers?|union|council|association|building|construction|architectural|occupational|industrial|mechanical|hvac|sheet|metal|metals|pipe|piping|welding|carpentry|rail|highway|transit|joint|regional|professional|specialist|technician|manager|director|officer|department|division|bureau|agency|commission|committee|institute|university|college|center|centre|issues|news|blog|article|resources|contact|sitemap|navigation|results|filter|service|services|product|industry|industries|business|company|corporation|incorporated|inc|llc|ltd|corp|group)\M'
)
, _detach AS (
  UPDATE public.talent_ingest_raw SET candidate_id = NULL
  WHERE candidate_id IN (SELECT id FROM junk)
  RETURNING 1
)
DELETE FROM public.hire_alert_candidates WHERE id IN (SELECT id FROM junk);