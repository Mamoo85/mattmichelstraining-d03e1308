-- Enrichment columns for outreach_leads (channel-prospector).
-- Filled by outreach-leads-enrich using Apollo → Hunter.io → Firecrawl waterfall.
-- channel-prospector-followup uses owner_email for email follow-up touches.

ALTER TABLE public.outreach_leads
  ADD COLUMN IF NOT EXISTS owner_name   TEXT,
  ADD COLUMN IF NOT EXISTS owner_email  TEXT,
  ADD COLUMN IF NOT EXISTS owner_phone  TEXT,
  ADD COLUMN IF NOT EXISTS website      TEXT,
  ADD COLUMN IF NOT EXISTS enriched_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_outreach_leads_unenriched
  ON public.outreach_leads (created_at DESC)
  WHERE owner_email IS NULL AND enriched_at IS NULL;
