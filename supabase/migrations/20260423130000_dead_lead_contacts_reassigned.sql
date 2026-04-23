-- Add is_reassigned flag to dead_lead_contacts
-- Populated by Twilio Lookup v2 reassigned_number intelligence at intake.
-- Contacts where is_reassigned=true are skipped by all drip loops — the
-- original consent holder no longer owns that phone number.

ALTER TABLE dead_lead_contacts
  ADD COLUMN IF NOT EXISTS is_reassigned BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN dead_lead_contacts.is_reassigned IS
  'True when Twilio Lookup v2 reports the number was reassigned after the EBR date. Drip loops skip these contacts.';
