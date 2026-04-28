-- Sprint E: Outreach hardening
-- 1. Idempotency: prevent double-enqueue of same (prospect, lead, channel) while pending/processing
CREATE UNIQUE INDEX IF NOT EXISTS outreach_send_queue_dedupe_active_idx
  ON public.outreach_send_queue (prospect_id, lead_id, channel)
  WHERE status IN ('pending', 'processing');

-- 2. Faster suppression lookups at send-time (worker re-check)
CREATE INDEX IF NOT EXISTS contractor_outreach_suppression_contact_lookup_idx
  ON public.contractor_outreach_suppression (contact_type, lower(contact));
