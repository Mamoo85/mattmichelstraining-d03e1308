-- Add ghost-record tracking columns to pod_product_queue
ALTER TABLE pod_product_queue
  ADD COLUMN IF NOT EXISTS publish_attempt_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_permanently bool DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_publish_error text;

-- Backfill: any existing published+null printify_id rows start at attempt 0
UPDATE pod_product_queue
SET publish_attempt_count = 0
WHERE status = 'published' AND printify_id IS NULL AND product_type != 'digital'
  AND publish_attempt_count IS NULL;
