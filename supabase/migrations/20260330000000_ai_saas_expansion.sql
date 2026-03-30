CREATE TABLE IF NOT EXISTS social_media_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  business_type TEXT,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  state TEXT,
  platforms TEXT[] DEFAULT '{}',
  fb_page_id TEXT,
  ig_account_id TEXT,
  linkedin_org_id TEXT,
  access_tokens JSONB DEFAULT '{}',
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'standard',
  active BOOLEAN NOT NULL DEFAULT false,
  last_post_at TIMESTAMPTZ,
  post_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE social_media_clients ENABLE ROW LEVEL SECURITY;
-- Service role only (admin business table)
CREATE POLICY "Service role manages social_media_clients"
  ON social_media_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
