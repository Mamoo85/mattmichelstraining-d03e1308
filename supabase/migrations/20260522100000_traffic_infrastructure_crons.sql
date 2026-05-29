-- Traffic infrastructure cron jobs for secondary project (zmyczlfuufhngzovkjdh)
-- Matches existing cron pattern: no vault auth (functions use verify_jwt = false)

-- Create gumroad_stats table if not exists
CREATE TABLE IF NOT EXISTS gumroad_stats (
  id              BIGSERIAL PRIMARY KEY,
  date            DATE UNIQUE NOT NULL,
  sales_count     INT NOT NULL DEFAULT 0,
  revenue_cents   INT NOT NULL DEFAULT 0,
  unique_products_sold INT NOT NULL DEFAULT 0,
  total_views_lifetime BIGINT NOT NULL DEFAULT 0,
  total_sales_lifetime BIGINT NOT NULL DEFAULT 0,
  total_revenue_lifetime_cents BIGINT NOT NULL DEFAULT 0,
  product_count   INT NOT NULL DEFAULT 0,
  raw_sales       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gumroad_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON gumroad_stats;
CREATE POLICY "service_role_all" ON gumroad_stats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- image-sitemap-generator: daily 6am UTC
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'image-sitemap-generator-daily';
SELECT cron.schedule(
  'image-sitemap-generator-daily',
  '0 6 * * *',
  'SELECT net.http_post(url:=''https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/image-sitemap-generator'',headers:=''{"Content-Type":"application/json"}''::jsonb,body:=''{}''::jsonb)'
);

-- gumroad-stats-collector: daily 7am UTC
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'gumroad-stats-collector-daily';
SELECT cron.schedule(
  'gumroad-stats-collector-daily',
  '0 7 * * *',
  'SELECT net.http_post(url:=''https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/gumroad-stats-collector'',headers:=''{"Content-Type":"application/json"}''::jsonb,body:=''{}''::jsonb)'
);

-- generate-sitemap: daily 5am UTC (pings Google + Bing after generating)
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'generate-sitemap-daily';
SELECT cron.schedule(
  'generate-sitemap-daily',
  '0 5 * * *',
  'SELECT net.http_post(url:=''https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/generate-sitemap'',headers:=''{"Content-Type":"application/json"}''::jsonb,body:=''{}''::jsonb)'
);

-- etsy-listing-completor: weekly Monday 9am UTC
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'etsy-listing-completor-weekly';
SELECT cron.schedule(
  'etsy-listing-completor-weekly',
  '0 9 * * 1',
  'SELECT net.http_post(url:=''https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/etsy-listing-completor'',headers:=''{"Content-Type":"application/json"}''::jsonb,body:=''{}''::jsonb)'
);

-- etsy-free-shipping-enforcer: weekly Monday 8am UTC
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'etsy-free-shipping-enforcer-weekly';
SELECT cron.schedule(
  'etsy-free-shipping-enforcer-weekly',
  '0 8 * * 1',
  'SELECT net.http_post(url:=''https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/etsy-free-shipping-enforcer'',headers:=''{"Content-Type":"application/json"}''::jsonb,body:=''{}''::jsonb)'
);
