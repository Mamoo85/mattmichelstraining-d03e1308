CREATE TABLE IF NOT EXISTS public.trade_show_followup_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  industry TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.trade_show_followup_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_trade_show_followup_clients"
  ON public.trade_show_followup_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
