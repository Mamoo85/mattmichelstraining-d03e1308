-- Growth Sprint: add bundled_with to missed_call_clients, pilot_active to contractor_clients

ALTER TABLE public.missed_call_clients
  ADD COLUMN IF NOT EXISTS bundled_with text DEFAULT NULL;

ALTER TABLE public.contractor_clients
  ADD COLUMN IF NOT EXISTS pilot_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dead_lead_billing_active boolean DEFAULT false;

-- Index for fast pilot lookup
CREATE INDEX IF NOT EXISTS idx_contractor_clients_pilot
  ON public.contractor_clients (pilot_active)
  WHERE pilot_active = true;
