ALTER TABLE social_media_clients
  ADD COLUMN IF NOT EXISTS brand_voice TEXT,
  ADD COLUMN IF NOT EXISTS post_topics JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
