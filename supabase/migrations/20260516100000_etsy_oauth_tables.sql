-- PKCE state storage (short-lived, cleaned up after use)
CREATE TABLE IF NOT EXISTS etsy_oauth_pkce (
  state        text PRIMARY KEY,
  code_verifier text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

-- OAuth tokens (long-lived, written by callback, read by uploader)
CREATE TABLE IF NOT EXISTS etsy_oauth_tokens (
  id            serial PRIMARY KEY,
  access_token  text NOT NULL,
  refresh_token text,
  token_type    text,
  expires_at    timestamptz,
  shop_id       text,
  user_id       text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
