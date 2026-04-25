CREATE TABLE IF NOT EXISTS public.marketplace_first_look_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  product text NOT NULL DEFAULT 'all',
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_first_look_email ON public.marketplace_first_look_subscribers(lower(email));
CREATE INDEX IF NOT EXISTS idx_mp_first_look_status ON public.marketplace_first_look_subscribers(status, product);

ALTER TABLE public.marketplace_first_look_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_mp_first_look"
ON public.marketplace_first_look_subscribers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);