-- Unified B2B agency client table
-- Every paid agency subscription writes here via stripe-webhook
CREATE TABLE IF NOT EXISTS public.b2b_clients (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name          TEXT NOT NULL,
  owner_name             TEXT,
  email                  TEXT NOT NULL,
  phone                  TEXT,
  service_type           TEXT NOT NULL,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  fulfillment_stage      TEXT NOT NULL DEFAULT 'New Lead - Action Required',
  -- stages: 'New Lead - Action Required', 'Onboarding', 'Active', 'Paused', 'Cancelled'
  notes                  TEXT,
  metadata               JSONB,
  active                 BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS b2b_clients_email_service_idx ON public.b2b_clients(email, service_type);
ALTER TABLE public.b2b_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_b2b_clients"
  ON public.b2b_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
