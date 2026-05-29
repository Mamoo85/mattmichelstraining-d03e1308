CREATE TABLE IF NOT EXISTS chatbot_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  business_type TEXT,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  lead_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE chatbot_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages chatbot_clients"
  ON chatbot_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
