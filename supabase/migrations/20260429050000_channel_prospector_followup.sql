-- Follow-up tracking for channel-prospector outreach_leads.
-- channel-prospector-followup reads these to send 7-day and 14-day touches.

ALTER TABLE public.outreach_leads
  ADD COLUMN IF NOT EXISTS followup_d7_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followup_d14_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_at           TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_outreach_leads_followup
  ON public.outreach_leads (last_contact_date, offer_pitched, followup_d14_sent_at)
  WHERE followup_d14_sent_at IS NULL AND replied_at IS NULL;
