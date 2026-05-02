
CREATE TABLE IF NOT EXISTS public.client_price_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_email TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  locked_price_cents INTEGER NOT NULL,
  tier TEXT NOT NULL DEFAULT 'monthly_499',
  lock_version TEXT NOT NULL DEFAULT 'v1',
  covered_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  carve_out_clause TEXT NOT NULL DEFAULT 'Forever Pricing covers the v1 feature set plus every monthly improvement to those features. Net-new product lines released after 24 months are opt-in at then-current rates.',
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_price_locks_email ON public.client_price_locks (lower(client_email));

ALTER TABLE public.client_price_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_price_locks"
  ON public.client_price_locks FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "client_can_view_own_lock"
  ON public.client_price_locks FOR SELECT TO authenticated
  USING (lower(client_email) = lower(coalesce((auth.jwt() ->> 'email')::text, '')));
