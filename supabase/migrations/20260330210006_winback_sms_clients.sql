CREATE TABLE IF NOT EXISTS public.winback_sms_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL UNIQUE,
  twilio_number TEXT,
  industry TEXT,
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  campaign_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.winback_sms_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  last_purchase_date DATE,
  opted_in BOOLEAN NOT NULL DEFAULT true,
  opted_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_email, contact_phone)
);

ALTER TABLE public.winback_sms_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages winback_sms_clients"
  ON public.winback_sms_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.winback_sms_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages winback_sms_contacts"
  ON public.winback_sms_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5th of month 10am ET (14:00 UTC)
SELECT cron.schedule(
  'winback-sms-monthly',
  '0 14 5 * *',
  $$
  SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/winback-sms-sender',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer service_role"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
