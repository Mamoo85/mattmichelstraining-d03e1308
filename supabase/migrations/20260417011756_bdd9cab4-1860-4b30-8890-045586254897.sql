-- Fix 1: Stripe webhook idempotency table
CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_processed_stripe_events"
  ON public.processed_stripe_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-cleanup events older than 30 days (optional housekeeping)
CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_processed_at
  ON public.processed_stripe_events(processed_at);

-- Fix 2: TCPA EBR — add last_contact_date to dead lead contacts
ALTER TABLE public.dead_lead_contacts
  ADD COLUMN IF NOT EXISTS last_contact_date DATE;

CREATE INDEX IF NOT EXISTS idx_dead_lead_contacts_last_contact_date
  ON public.dead_lead_contacts(last_contact_date);