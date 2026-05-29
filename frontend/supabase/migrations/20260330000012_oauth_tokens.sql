CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages oauth_tokens"
  ON oauth_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
