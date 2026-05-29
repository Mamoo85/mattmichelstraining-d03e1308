-- TikTok OAuth tokens table (mirrors youtube_oauth_tokens pattern)
CREATE TABLE IF NOT EXISTS tiktok_oauth_tokens (
  id            bigserial PRIMARY KEY,
  access_token  text        NOT NULL,
  refresh_token text        NOT NULL,
  expires_at    timestamptz NOT NULL,
  display_name  text,
  open_id       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- TikTok posts tracking
CREATE TABLE IF NOT EXISTS tiktok_posts (
  id          bigserial PRIMARY KEY,
  publish_id  text        NOT NULL,
  title       text,
  niche       text,
  hashtags    text[],
  status      text        DEFAULT 'processing',
  posted_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tiktok_posts_publish_id_idx
  ON tiktok_posts(publish_id);

-- RLS
ALTER TABLE tiktok_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages tiktok tokens"
  ON tiktok_oauth_tokens FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages tiktok posts"
  ON tiktok_posts FOR ALL
  USING (auth.role() = 'service_role');
