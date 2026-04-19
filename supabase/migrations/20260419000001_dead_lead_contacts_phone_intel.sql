-- Item 34 & 36: Phone carrier intelligence columns for dead_lead_contacts
-- Populated by dead-lead-intake via Twilio Lookup v2 at submission time.

ALTER TABLE public.dead_lead_contacts
  ADD COLUMN IF NOT EXISTS phone_carrier_type TEXT,
  ADD COLUMN IF NOT EXISTS is_dnc_risk BOOLEAN DEFAULT FALSE;

-- Item 42: Terminal status for Sonar-detected completed projects
-- Prevents drip from texting homeowners who already finished the project.
ALTER TABLE public.dead_lead_contacts
  ADD COLUMN IF NOT EXISTS project_completed_at TIMESTAMPTZ;
