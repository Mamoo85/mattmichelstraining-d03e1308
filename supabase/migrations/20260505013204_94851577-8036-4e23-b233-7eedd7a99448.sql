-- TechAlert prospect drip columns
ALTER TABLE public.techalert_prospect_targets
  ADD COLUMN IF NOT EXISTS followup_d3_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followup_d7_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followup_d14_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reply_positive       BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_techalert_prospect_targets_drip
  ON public.techalert_prospect_targets (outreach_sent_at, followup_d14_sent_at)
  WHERE outreach_sent_at IS NOT NULL AND followup_d14_sent_at IS NULL AND replied_at IS NULL;

-- Outreach leads (channel-prospector + drip) follow-up columns
ALTER TABLE public.outreach_leads
  ADD COLUMN IF NOT EXISTS followup_d7_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followup_d14_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_at           TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_outreach_leads_followup
  ON public.outreach_leads (last_contact_date, offer_pitched, followup_d14_sent_at)
  WHERE followup_d14_sent_at IS NULL AND replied_at IS NULL;