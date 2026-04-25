-- Add dashboard_token to missed_call_clients for magic-link portal access.
-- Add access_expires_at to marketplace_lead_locks so purchased access has a visible expiry.

ALTER TABLE public.missed_call_clients
  ADD COLUMN IF NOT EXISTS dashboard_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');

-- Back-fill any existing rows that have a NULL token (safety net).
UPDATE public.missed_call_clients
  SET dashboard_token = encode(gen_random_bytes(16), 'hex')
  WHERE dashboard_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_missed_call_clients_dashboard_token
  ON public.missed_call_clients (dashboard_token);

-- Purchased marketplace lead access expires 30 days after sale.
ALTER TABLE public.marketplace_lead_locks
  ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ;
