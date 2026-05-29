-- Phase 79 remaining — Part 2: State sync schema hardening
-- Adds write-back tracking columns, append-only publish event log,
-- and a unified health view across the three listing state tables.

-- ── 1. Write-back tracking columns on pod_product_queue ──────────────────────
ALTER TABLE pod_product_queue
  ADD COLUMN IF NOT EXISTS etsy_listing_id_confirmed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS listing_write_back_attempts   SMALLINT DEFAULT 0;

COMMENT ON COLUMN pod_product_queue.etsy_listing_id_confirmed_at
  IS 'When etsy_listing_id was first confirmed via Printify external.id (not fuzzy-matched)';
COMMENT ON COLUMN pod_product_queue.listing_write_back_attempts
  IS 'How many times write-back was attempted; >3 = needs manual investigation';

-- ── 2. pod_publish_events — append-only publish audit log ────────────────────
-- Written at every Printify publish attempt. Never update rows — only insert.
-- Enables replay debugging, duplicate publish detection, and ghost recovery.
CREATE TABLE IF NOT EXISTS pod_publish_events (
  id                BIGSERIAL PRIMARY KEY,
  queue_id          INT           REFERENCES pod_product_queue(id) ON DELETE SET NULL,
  printify_id       TEXT,
  etsy_listing_id   TEXT,
  event_type        TEXT NOT NULL, -- 'publish_attempt' | 'publish_success' | 'publish_failed' | 'etsy_id_confirmed'
  payload           JSONB,
  error_message     TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pod_publish_events_queue_id
  ON pod_publish_events (queue_id);
CREATE INDEX IF NOT EXISTS idx_pod_publish_events_printify_id
  ON pod_publish_events (printify_id)
  WHERE printify_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pod_publish_events_type_created
  ON pod_publish_events (event_type, created_at DESC);

COMMENT ON TABLE pod_publish_events
  IS 'Append-only log of every Printify publish attempt. Never update rows.';

-- ── 3. pod_listing_unified — health view across all three tables ──────────────
-- Joins pod_product_queue (source of truth), pod_listings (legacy), etsy_listings
-- (storefront mirror) on etsy_listing_id. Exposes orphan and tag-gap detection.
CREATE OR REPLACE VIEW pod_listing_unified AS
SELECT
  q.id                          AS queue_id,
  q.name                        AS product_name,
  q.product_type,
  q.status                      AS queue_status,
  q.printify_id,
  q.etsy_listing_id,
  q.etsy_listing_id_confirmed_at,
  q.listing_write_back_attempts,
  q.visual_score,
  q.visual_checked_at,
  q.failed_permanently,
  q.last_publish_error,
  q.created_at                  AS queued_at,

  -- etsy_listings mirror (populated by etsy-listing-sync daily)
  el.title                      AS etsy_title,
  el.price_usd                  AS etsy_price,
  el.num_favorers               AS etsy_favorers,
  array_length(el.tags, 1)      AS etsy_tag_count,
  el.status                     AS etsy_status,
  el.synced_at                  AS etsy_synced_at,

  -- Derived health flags
  (q.status = 'published' AND q.etsy_listing_id IS NULL)        AS is_ghost,
  (q.status = 'published' AND el.listing_id IS NULL)            AS is_orphan,
  (el.tags IS NULL OR array_length(el.tags, 1) < 13)            AS has_tag_gap,
  (q.listing_write_back_attempts > 3)                           AS write_back_stuck,
  (q.visual_score IS NOT NULL AND q.visual_score <= 2)          AS visual_failed

FROM pod_product_queue q
LEFT JOIN etsy_listings el ON el.listing_id = q.etsy_listing_id
WHERE q.product_type != 'download'  -- digital products tracked separately
ORDER BY q.created_at DESC;

COMMENT ON VIEW pod_listing_unified IS
  'Health view across pod_product_queue and etsy_listings. '
  'is_ghost = published but no etsy_listing_id. '
  'is_orphan = has queue row but no matching etsy_listings row (not yet synced or delisted). '
  'has_tag_gap = fewer than 13 tags on Etsy. '
  'write_back_stuck = write-back attempted >3 times without success.';

-- ── 4. Convenience query: system health summary ───────────────────────────────
-- Run this to get a one-row dashboard snapshot:
--   SELECT * FROM pod_health_summary;
CREATE OR REPLACE VIEW pod_health_summary AS
SELECT
  COUNT(*)                                    AS total_published,
  COUNT(*) FILTER (WHERE is_ghost)            AS ghost_count,
  COUNT(*) FILTER (WHERE is_orphan)           AS orphan_count,
  COUNT(*) FILTER (WHERE has_tag_gap)         AS tag_gap_count,
  COUNT(*) FILTER (WHERE write_back_stuck)    AS write_back_stuck_count,
  COUNT(*) FILTER (WHERE visual_failed)       AS visual_failed_count,
  MAX(etsy_synced_at)                         AS last_etsy_sync,
  now()                                       AS checked_at
FROM pod_listing_unified
WHERE queue_status = 'published';

COMMENT ON VIEW pod_health_summary IS
  'One-row dashboard: run SELECT * FROM pod_health_summary to see system health at a glance.';
