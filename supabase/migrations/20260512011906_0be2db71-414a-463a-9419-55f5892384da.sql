-- Dedupe existing rows first (keep oldest), then add unique constraint
DELETE FROM public.techalert_prospect_targets a
USING public.techalert_prospect_targets b
WHERE a.ctid < b.ctid
  AND lower(a.company_name) = lower(b.company_name)
  AND coalesce(a.state,'') = coalesce(b.state,'');

CREATE UNIQUE INDEX IF NOT EXISTS techalert_prospect_targets_company_state_uniq
  ON public.techalert_prospect_targets (company_name, state);
