ALTER TABLE public.lead_credit_requests
  ADD COLUMN IF NOT EXISTS amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_credit_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lcr_lead_requester
  ON public.lead_credit_requests (lead_id, requester_email);