-- meta_ad_campaigns — tracks Meta ad campaigns created by meta-ads-poster
CREATE TABLE IF NOT EXISTS meta_ad_campaigns (
  id               bigserial PRIMARY KEY,
  job_id           text,                    -- references ad_studio_jobs.id
  campaign_id      text NOT NULL UNIQUE,    -- Meta campaign ID
  adset_id         text,
  creative_id      text,
  ad_id            text,
  page_id          text,                    -- Facebook Page used as ad identity
  brand_slug       text DEFAULT 'm2',       -- m2 | dwa | gng
  campaign_name    text,
  status           text DEFAULT 'PAUSED',  -- PAUSED | ACTIVE | ARCHIVED
  daily_budget_cents int,
  spend_cents      int DEFAULT 0,
  impressions      int DEFAULT 0,
  clicks           int DEFAULT 0,
  ads_manager_url  text,
  image_url        text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meta_ad_campaigns_brand_idx ON meta_ad_campaigns(brand_slug);
CREATE INDEX IF NOT EXISTS meta_ad_campaigns_status_idx ON meta_ad_campaigns(status);
CREATE INDEX IF NOT EXISTS meta_ad_campaigns_created_idx ON meta_ad_campaigns(created_at DESC);

-- Enable RLS (service role bypasses it)
ALTER TABLE meta_ad_campaigns ENABLE ROW LEVEL SECURITY;
