CREATE TABLE IF NOT EXISTS missed_call_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL,
  business_phone TEXT,
  twilio_number TEXT,
  response_message TEXT DEFAULT 'Hey! I just missed your call — I''ll call you right back. How can I help you?',
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  call_count INT NOT NULL DEFAULT 0,
  text_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE missed_call_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages missed_call_clients"
  ON missed_call_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
