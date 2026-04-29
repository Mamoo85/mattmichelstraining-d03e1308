-- Enrichment + outreach tracking columns for techalert_prospect_targets.
-- The enrich drain (7am ET) fills owner contact info via Apollo.
-- The outreach function (8am ET) sends cold emails and marks outreach_sent_at.

ALTER TABLE public.techalert_prospect_targets
  ADD COLUMN IF NOT EXISTS state            TEXT,
  ADD COLUMN IF NOT EXISTS website          TEXT,
  ADD COLUMN IF NOT EXISTS employee_count   INT,
  ADD COLUMN IF NOT EXISTS owner_name       TEXT,
  ADD COLUMN IF NOT EXISTS owner_email      TEXT,
  ADD COLUMN IF NOT EXISTS owner_phone      TEXT,
  ADD COLUMN IF NOT EXISTS owner_linkedin   TEXT,
  ADD COLUMN IF NOT EXISTS enriched_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outreach_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outreach_status  TEXT;

-- Index for the enrich drain query (unenriched new prospects)
CREATE INDEX IF NOT EXISTS idx_techalert_targets_enrich
  ON public.techalert_prospect_targets (enriched_at, status)
  WHERE enriched_at IS NULL AND status = 'new';

-- Index for the outreach query (enriched, unsent, scored)
CREATE INDEX IF NOT EXISTS idx_techalert_targets_outreach
  ON public.techalert_prospect_targets (outreach_sent_at, enriched_at, score)
  WHERE outreach_sent_at IS NULL AND enriched_at IS NOT NULL;
