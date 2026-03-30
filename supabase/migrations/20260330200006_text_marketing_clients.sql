CREATE TABLE IF NOT EXISTS public.text_marketing_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  twilio_number TEXT,
  industry TEXT,
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  campaign_count INT NOT NULL DEFAULT 0,
  subscriber_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.text_marketing_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  opted_in BOOLEAN NOT NULL DEFAULT true,
  opted_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_email, contact_phone)
);

ALTER TABLE public.text_marketing_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages text_marketing_clients"
  ON public.text_marketing_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.text_marketing_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages text_marketing_contacts"
  ON public.text_marketing_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);
