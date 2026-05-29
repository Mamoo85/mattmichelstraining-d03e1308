-- competitor_intelligence — tracked_shops + shop_daily_metrics
-- Part of DWA SaaS Platform: Competitor Espionage & Intelligence Machine
-- Populated by shop-intelligence function (nightly 4:59am UTC = 11:59pm EST)
-- Multi-tenant: user_id isolates data; DWA sentinel UUID seeds internal cohort

-- tracked_shops: competitor shops being monitored (multi-tenant)
CREATE TABLE IF NOT EXISTS tracked_shops (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001', -- DWA internal sentinel
  shop_name       text NOT NULL,           -- Etsy shop handle (e.g. 'CaitlynMinimalist')
  shop_url        text NOT NULL,           -- https://www.etsy.com/shop/{name}
  etsy_shop_id    text,                    -- populated on first successful API call
  vertical        text,                    -- 'pod' | 'drinkware' | 'apparel' | 'gifts' | '3dprint'
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(user_id, shop_name)
);

CREATE INDEX IF NOT EXISTS tracked_shops_user_active_idx ON tracked_shops (user_id, active);

ALTER TABLE tracked_shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_shops" ON tracked_shops;
CREATE POLICY "own_shops" ON tracked_shops
  FOR ALL
  USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000001');

-- shop_daily_metrics: time-series intelligence log (one row per shop per day)
CREATE TABLE IF NOT EXISTS shop_daily_metrics (
  id                      bigserial PRIMARY KEY,
  shop_id                 uuid NOT NULL REFERENCES tracked_shops(id) ON DELETE CASCADE,
  metric_date             date NOT NULL DEFAULT CURRENT_DATE,
  total_reviews           int,
  active_listing_count    int,
  avg_listing_price_cents int,
  review_delta            int,             -- today_reviews - yesterday_reviews
  estimated_daily_sales   numeric(10,2),   -- review_delta * 4.5
  estimated_daily_revenue numeric(12,2),   -- estimated_daily_sales * (avg_listing_price_cents / 100)
  data_source             text DEFAULT 'api', -- 'api' | 'scrape'
  raw_snapshot            jsonb,           -- full API response for debugging
  created_at              timestamptz DEFAULT now(),
  UNIQUE(shop_id, metric_date)
);

CREATE INDEX IF NOT EXISTS shop_daily_metrics_shop_date_idx ON shop_daily_metrics (shop_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS shop_daily_metrics_date_idx      ON shop_daily_metrics (metric_date DESC);

ALTER TABLE shop_daily_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "join_tracked_shops" ON shop_daily_metrics;
CREATE POLICY "join_tracked_shops" ON shop_daily_metrics
  FOR ALL
  USING (
    shop_id IN (
      SELECT id FROM tracked_shops
      WHERE user_id = auth.uid()
         OR user_id = '00000000-0000-0000-0000-000000000001'
    )
  );
