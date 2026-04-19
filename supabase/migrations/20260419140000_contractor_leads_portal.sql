-- Contractor Leads Portal: add contractor_feedback + bad_lead tracking to contractor_leads
-- contractor_feedback: set by contractor via portal (called / hired / bad_lead)
-- bad_lead_flagged_at: timestamp when flagged for Matt review

ALTER TABLE public.contractor_leads
  ADD COLUMN IF NOT EXISTS contractor_feedback text
    CHECK (contractor_feedback IN ('called', 'hired', 'bad_lead')),
  ADD COLUMN IF NOT EXISTS bad_lead_flagged_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contractor_leads_feedback
  ON public.contractor_leads (client_id, contractor_feedback)
  WHERE contractor_feedback IS NOT NULL;
