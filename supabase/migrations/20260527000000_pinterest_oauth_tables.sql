-- Pinterest OAuth tables for secondary (POD) project
-- Used by pinterest-oauth edge function to store tokens and CSRF state

-- Stores tokens after user completes OAuth flow
CREATE TABLE IF NOT EXISTS pinterest_oauth_tokens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_label     text NOT NULL DEFAULT 'matt',  -- identifier (matt, or client email for multi-user)
  access_token   text NOT NULL,
  refresh_token  text,
  token_type     text NOT NULL DEFAULT 'bearer',
  scope          text,
  expires_at     timestamptz,
  pinterest_user_id   text,
  pinterest_username  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_label)
);

ALTER TABLE pinterest_oauth_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full" ON pinterest_oauth_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Stores temporary CSRF state during OAuth flow (auto-expires in 10 minutes)
CREATE TABLE IF NOT EXISTS pinterest_oauth_state (
  state          text PRIMARY KEY,
  redirect_after text NOT NULL DEFAULT 'https://detroitwebagent.com/dwa-admin/shorts',
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pinterest_oauth_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full" ON pinterest_oauth_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Auto-cleanup stale states older than 15 minutes (safety valve)
CREATE OR REPLACE FUNCTION cleanup_pinterest_oauth_state()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM pinterest_oauth_state WHERE created_at < now() - interval '15 minutes';
$$;
