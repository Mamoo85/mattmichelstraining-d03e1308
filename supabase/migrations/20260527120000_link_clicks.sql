-- Phase: POD Measurement Loop (applied manually to secondary zmyczlfuufhngzovkjdh)
-- CI/CD applies to PRIMARY only — this was run via MCP apply_migration.

-- 1. link_clicks attribution table
CREATE TABLE IF NOT EXISTS link_clicks (
  id          BIGSERIAL PRIMARY KEY,
  channel     TEXT,
  campaign    TEXT,
  listing_id  TEXT,
  target_url  TEXT,
  ts          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_link_clicks_ts      ON link_clicks (ts DESC);
CREATE INDEX IF NOT EXISTS idx_link_clicks_channel ON link_clicks (channel, campaign);
CREATE INDEX IF NOT EXISTS idx_link_clicks_listing ON link_clicks (listing_id) WHERE listing_id IS NOT NULL;

-- 2. pod_product_queue: scoring + hero columns
ALTER TABLE pod_product_queue
  ADD COLUMN IF NOT EXISTS listing_viability_score INTEGER,
  ADD COLUMN IF NOT EXISTS last_scored_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_hero                 BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ppq_hero_score
  ON pod_product_queue (is_hero, listing_viability_score DESC NULLS LAST)
  WHERE status = 'published';

-- 3. youtube_shorts: add niche column (view_count/like_count/comment_count/stats_updated_at already existed)
ALTER TABLE youtube_shorts
  ADD COLUMN IF NOT EXISTS niche TEXT;

CREATE INDEX IF NOT EXISTS idx_youtube_shorts_niche
  ON youtube_shorts (niche) WHERE niche IS NOT NULL;

-- 4. Replace youtube_niche_performance view (old version had different column set)
DROP VIEW IF EXISTS youtube_niche_performance;
CREATE VIEW youtube_niche_performance AS
SELECT
  COALESCE(
    niche,
    CASE
      WHEN title ~~* '%electrician%' OR title ~~* '%plumb%' OR title ~~* '%welder%' THEN 'trades'
      WHEN title ~~* '%squat%' OR title ~~* '%gym%' OR title ~~* '%workout%'       THEN 'fitness'
      WHEN title ~~* '%coffee%' OR title ~~* '%espresso%'                          THEN 'coffee'
      WHEN title ~~* '%cook%' OR title ~~* '%steak%' OR title ~~* '%spice%'        THEN 'cooking'
      WHEN title ~~* '%nurse%' OR title ~~* '%doctor%'                             THEN 'healthcare'
      WHEN title ~~* '%dog%' OR title ~~* '%puppy%'                                THEN 'dog'
      WHEN title ~~* '%cat%' OR title ~~* '%kitty%'                                THEN 'cat'
      WHEN title ~~* '%teacher%' OR title ~~* '%school%'                           THEN 'teacher'
      ELSE 'other'
    END
  )                                                    AS niche,
  COUNT(*)                                             AS video_count,
  COALESCE(SUM(view_count), 0)                        AS total_views,
  ROUND(COALESCE(AVG(view_count), 0)::numeric, 1)     AS avg_views,
  COALESCE(SUM(like_count), 0)                        AS total_likes
FROM youtube_shorts
GROUP BY 1
ORDER BY avg_views DESC;
