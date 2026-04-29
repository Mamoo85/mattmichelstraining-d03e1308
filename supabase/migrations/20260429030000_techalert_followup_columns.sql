-- Follow-up drip tracking for techalert_prospect_targets.
-- techalert-followup-drip reads these to decide which touch to send next.

ALTER TABLE public.techalert_prospect_targets
  ADD COLUMN IF NOT EXISTS followup_d3_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followup_d7_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followup_d14_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reply_positive       BOOLEAN;

-- Index for the drip query
CREATE INDEX IF NOT EXISTS idx_techalert_targets_drip
  ON public.techalert_prospect_targets (outreach_sent_at, followup_d14_sent_at)
  WHERE outreach_sent_at IS NOT NULL AND followup_d14_sent_at IS NULL AND replied_at IS NULL;
