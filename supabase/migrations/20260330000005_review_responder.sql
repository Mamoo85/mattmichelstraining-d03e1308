CREATE TABLE IF NOT EXISTS review_responder_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  gmb_location_id TEXT,
  gmb_access_token TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'standard',
  active BOOLEAN NOT NULL DEFAULT false,
  last_checked_at TIMESTAMPTZ,
  review_count INT NOT NULL DEFAULT 0,
  response_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE review_responder_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages review_responder_clients"
  ON review_responder_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
