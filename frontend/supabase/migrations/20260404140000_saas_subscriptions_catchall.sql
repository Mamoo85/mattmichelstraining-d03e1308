-- Generic catch-all table for subscription types not yet handled by dedicated tables.
-- The stripe-webhook catch-all handler writes here for any meta.type not explicitly matched.
-- This ensures NO paid subscriber falls through the cracks at launch.

CREATE TABLE IF NOT EXISTS public.saas_subscriptions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                text NOT NULL,
  product_type         text NOT NULL,
  business_name        text,
  name                 text,
  phone                text,
  city                 text,
  state                text DEFAULT 'MI',
  active               boolean NOT NULL DEFAULT true,
  stripe_customer_id   text,
  stripe_session_id    text,
  metadata             jsonb DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, product_type)
);

ALTER TABLE public.saas_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.saas_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_email        ON public.saas_subscriptions (email);
CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_product_type ON public.saas_subscriptions (product_type);
CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_active       ON public.saas_subscriptions (active);
