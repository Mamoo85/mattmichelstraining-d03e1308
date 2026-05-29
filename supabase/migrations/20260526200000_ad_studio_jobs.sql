-- ad_studio_jobs: tracks every AI-generated ad creative
-- One row per variation+concept. format_urls is a jsonb map of format→storage_url.

CREATE TABLE IF NOT EXISTS ad_studio_jobs (
  id                bigserial PRIMARY KEY,
  product           text        NOT NULL,
  niche             text,
  concept_name      text        NOT NULL,  -- lifestyle | product_hero | social_proof
  headline          text,
  subhead           text,
  brand_color       text,
  cta_text          text,
  cta_url           text,
  format_urls       jsonb       NOT NULL DEFAULT '{}',  -- {meta_feed: url, meta_story: url, ...}
  formats_generated text[]      NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Index for product-based lookups (e.g. "show me all ads for Funny Nurse Mug")
CREATE INDEX IF NOT EXISTS ad_studio_jobs_product_idx ON ad_studio_jobs(product);
CREATE INDEX IF NOT EXISTS ad_studio_jobs_created_idx ON ad_studio_jobs(created_at DESC);
