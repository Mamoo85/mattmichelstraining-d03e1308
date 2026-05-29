-- Per-subscription ledger — one row per active service per client
CREATE TABLE IF NOT EXISTS public.service_subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id              UUID REFERENCES public.b2b_clients(id) ON DELETE CASCADE,
  email                  TEXT NOT NULL,
  service_type           TEXT NOT NULL,
  stripe_subscription_id TEXT,
  stripe_customer_id     TEXT,
  status                 TEXT NOT NULL DEFAULT 'active',
  monthly_value          NUMERIC(10,2),
  start_date             TIMESTAMPTZ DEFAULT now(),
  end_date               TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.service_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_service_subscriptions"
  ON public.service_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
