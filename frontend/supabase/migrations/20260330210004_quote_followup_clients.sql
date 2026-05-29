CREATE TABLE IF NOT EXISTS public.quote_followup_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL UNIQUE,
  twilio_number TEXT,
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  followups_sent INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quote_followup_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  prospect_name TEXT NOT NULL,
  prospect_phone TEXT NOT NULL,
  job_type TEXT,
  quote_amount TEXT,
  step INT NOT NULL DEFAULT 1,
  next_send_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.quote_followup_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages quote_followup_clients"
  ON public.quote_followup_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.quote_followup_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages quote_followup_queue"
  ON public.quote_followup_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
