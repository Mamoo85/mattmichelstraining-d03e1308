CREATE TABLE IF NOT EXISTS public.invoicing_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  invoice_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.invoicing_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages invoicing_clients"
  ON public.invoicing_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
