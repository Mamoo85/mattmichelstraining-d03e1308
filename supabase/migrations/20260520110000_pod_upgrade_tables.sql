-- POD Pipeline v2 upgrade tables
-- Supports 20 technical upgrades: dead letter queue, stats attribution, niche library,
-- provider arbitrage, image variants, title variants, market prices, price history, and more.

-- ── 1. Dead Letter Queue columns on pod_product_queue (#17) ───────────────────
ALTER TABLE pod_product_queue
  ADD COLUMN IF NOT EXISTS error_count       int          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead              boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS penetration_mode  boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS layout_template   text;

-- ── 2. Google Trends columns on etsy_pod_trends (#3) ─────────────────────────
ALTER TABLE etsy_pod_trends
  ADD COLUMN IF NOT EXISTS google_trend_score   int,
  ADD COLUMN IF NOT EXISTS trend_trajectory     text; -- 'rising' | 'stable' | 'declining'

-- ── 3. Dynamic Niche Library (#1) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pod_niche_library (
  niche              text PRIMARY KEY,
  weighted_score_avg float   NOT NULL DEFAULT 0,
  total_scans        int     NOT NULL DEFAULT 0,
  last_scanned_at    timestamptz,
  source             text    NOT NULL DEFAULT 'manual',
  active             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Seed with the current 22 hardcoded niches
INSERT INTO pod_niche_library (niche, source) VALUES
  ('funny nurse mug',              'seed'),
  ('retirement gift mug',          'seed'),
  ('sarcastic mug',                'seed'),
  ('engineer gift mug',            'seed'),
  ('funny dog dad mug',            'seed'),
  ('teacher mug gift',             'seed'),
  ('funny dad mug',                'seed'),
  ('best dad ever mug',            'seed'),
  ('girl dad mug',                 'seed'),
  ('new dad mug',                  'seed'),
  ('dad joke mug',                 'seed'),
  ('fishing dad mug',              'seed'),
  ('dog mom shirt',                'seed'),
  ('cat lover shirt',              'seed'),
  ('nurse life shirt',             'seed'),
  ('plant lady shirt',             'seed'),
  ('teacher shirt funny',          'seed'),
  ('dog dad shirt',                'seed'),
  ('world''s okayest dad shirt',   'seed'),
  ('dad bod certified shirt',      'seed'),
  ('golf dad shirt',               'seed'),
  ('dog dad gift shirt',           'seed')
ON CONFLICT (niche) DO NOTHING;

ALTER TABLE pod_niche_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON pod_niche_library
  FOR ALL USING (auth.role() = 'service_role');

-- ── 4. Printify Sales Metrics (#2) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pod_sales_metrics (
  product_type   text PRIMARY KEY,
  units_last_7d  int   NOT NULL DEFAULT 0,
  units_last_30d int   NOT NULL DEFAULT 0,
  sales_velocity float NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pod_sales_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON pod_sales_metrics
  FOR ALL USING (auth.role() = 'service_role');

-- ── 5. Market Prices (#13) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pod_market_prices (
  product_type  text PRIMARY KEY,
  p25_cents     int  NOT NULL DEFAULT 0,
  median_cents  int  NOT NULL DEFAULT 0,
  p75_cents     int  NOT NULL DEFAULT 0,
  sample_size   int  NOT NULL DEFAULT 0,
  recorded_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pod_market_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON pod_market_prices
  FOR ALL USING (auth.role() = 'service_role');

-- ── 6. Provider Costs (#14) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pod_provider_costs (
  blueprint_id    int  NOT NULL,
  provider_id     int  NOT NULL,
  provider_name   text NOT NULL DEFAULT '',
  base_cost_cents int  NOT NULL DEFAULT 0,
  rating          float NOT NULL DEFAULT 0,
  production_days int  NOT NULL DEFAULT 5,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blueprint_id, provider_id)
);

ALTER TABLE pod_provider_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON pod_provider_costs
  FOR ALL USING (auth.role() = 'service_role');

-- ── 7. Listing Stats (#9) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pod_listing_stats (
  id              bigserial PRIMARY KEY,
  etsy_listing_id text      NOT NULL,
  views           int       NOT NULL DEFAULT 0,
  favorites       int       NOT NULL DEFAULT 0,
  conversion_rate float     NOT NULL DEFAULT 0,
  num_sold        int       NOT NULL DEFAULT 0,
  revenue_cents   int       NOT NULL DEFAULT 0,
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pod_listing_stats_listing_idx ON pod_listing_stats (etsy_listing_id, recorded_at DESC);

ALTER TABLE pod_listing_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON pod_listing_stats
  FOR ALL USING (auth.role() = 'service_role');

-- ── 8. Listing Variants for A/B Title Testing (#11) ──────────────────────────
CREATE TABLE IF NOT EXISTS pod_listing_variants (
  id                bigserial PRIMARY KEY,
  etsy_listing_id   text      NOT NULL,
  variant_index     int       NOT NULL, -- 0, 1, 2
  title             text      NOT NULL,
  activated_at      timestamptz,
  views_during_period int     NOT NULL DEFAULT 0,
  is_active         boolean   NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pod_listing_variants_listing_idx ON pod_listing_variants (etsy_listing_id);

ALTER TABLE pod_listing_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON pod_listing_variants
  FOR ALL USING (auth.role() = 'service_role');

-- ── 9. Image Variants for A/B CTR Testing (#6) ───────────────────────────────
CREATE TABLE IF NOT EXISTS pod_image_variants (
  id                bigserial PRIMARY KEY,
  queue_id          bigint    REFERENCES pod_product_queue(id) ON DELETE SET NULL,
  variant_index     int       NOT NULL, -- 0=A (bold), 1=B (minimal)
  printify_image_id text,
  dall_e_prompt     text      NOT NULL,
  is_active         boolean   NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pod_image_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON pod_image_variants
  FOR ALL USING (auth.role() = 'service_role');

-- ── 10. Tag Registry (#12) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pod_tag_registry (
  tag             text PRIMARY KEY,
  listing_count   int  NOT NULL DEFAULT 0,
  last_updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pod_tag_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON pod_tag_registry
  FOR ALL USING (auth.role() = 'service_role');

-- ── 11. Price History (#15) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pod_price_history (
  id              bigserial PRIMARY KEY,
  etsy_listing_id text      NOT NULL,
  old_price_cents int       NOT NULL,
  new_price_cents int       NOT NULL,
  trigger_reason  text      NOT NULL DEFAULT '',
  changed_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pod_price_history_listing_idx ON pod_price_history (etsy_listing_id);

ALTER TABLE pod_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON pod_price_history
  FOR ALL USING (auth.role() = 'service_role');

-- ── 12. Removed Listings (#18) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pod_removed_listings (
  id                 bigserial PRIMARY KEY,
  etsy_listing_id    text,
  printify_product_id text,
  title              text      NOT NULL DEFAULT '',
  removed_at         timestamptz NOT NULL DEFAULT now(),
  recovery_queue_id  bigint    REFERENCES pod_product_queue(id) ON DELETE SET NULL
);

ALTER TABLE pod_removed_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON pod_removed_listings
  FOR ALL USING (auth.role() = 'service_role');

-- ── 13. Listing Snapshots (#20) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pod_listing_snapshots (
  id              bigserial PRIMARY KEY,
  etsy_listing_id text      NOT NULL,
  title           text      NOT NULL DEFAULT '',
  description     text      NOT NULL DEFAULT '',
  tags            text[]    NOT NULL DEFAULT '{}',
  price_cents     int       NOT NULL DEFAULT 0,
  state           text      NOT NULL DEFAULT '',
  snapshot_date   date      NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pod_listing_snapshots_date_idx ON pod_listing_snapshots (snapshot_date DESC);
CREATE INDEX IF NOT EXISTS pod_listing_snapshots_listing_idx ON pod_listing_snapshots (etsy_listing_id);

ALTER TABLE pod_listing_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON pod_listing_snapshots
  FOR ALL USING (auth.role() = 'service_role');

-- ── 14. State keys for new agents ─────────────────────────────────────────────
INSERT INTO pod_agent_state (key, value) VALUES
  ('critique_rejection_rate', '0'),
  ('niche_library_last_expanded', '2026-01-01'),
  ('provider_last_checked', '2026-01-01')
ON CONFLICT (key) DO NOTHING;
