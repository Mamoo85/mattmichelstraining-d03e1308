-- Phase 73: Post-publish visual confirmation columns
-- After Etsy publish, pod-visual-confirm fetches the listing's primary image,
-- runs GPT Vision, and updates these columns.

ALTER TABLE pod_product_queue
  ADD COLUMN IF NOT EXISTS etsy_listing_id TEXT,
  ADD COLUMN IF NOT EXISTS visual_score     SMALLINT,
  ADD COLUMN IF NOT EXISTS visual_checked_at TIMESTAMPTZ;

-- Index to quickly find products needing visual confirmation
CREATE INDEX IF NOT EXISTS idx_pod_queue_visual_pending
  ON pod_product_queue (status, created_at)
  WHERE status = 'visual_failed';

COMMENT ON COLUMN pod_product_queue.etsy_listing_id    IS 'Etsy listing ID after Printify publish sync';
COMMENT ON COLUMN pod_product_queue.visual_score       IS 'GPT Vision score 1-5 on the Etsy listing primary image. NULL = not checked yet. ≤2 = visual_failed.';
COMMENT ON COLUMN pod_product_queue.visual_checked_at  IS 'When the post-publish visual check ran';
