CREATE TABLE IF NOT EXISTS public.holiday_sms_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL UNIQUE,
  twilio_number TEXT,
  industry TEXT,
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  messages_sent INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.holiday_sms_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  opted_in BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_email, contact_phone)
);

ALTER TABLE public.holiday_sms_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages holiday_sms_clients"
  ON public.holiday_sms_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.holiday_sms_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages holiday_sms_contacts"
  ON public.holiday_sms_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);
