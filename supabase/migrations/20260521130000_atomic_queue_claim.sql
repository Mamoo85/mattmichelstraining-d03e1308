-- Atomic queue item claim using FOR UPDATE SKIP LOCKED.
-- Replaces the non-atomic SELECT + UPDATE pattern in pod-new-products
-- that caused duplicate products when many workers ran concurrently.
CREATE OR REPLACE FUNCTION claim_next_queue_item()
RETURNS SETOF pod_product_queue
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE pod_product_queue
  SET status = 'processing', updated_at = now()
  WHERE id = (
    SELECT id
    FROM pod_product_queue
    WHERE status = 'pending'
      AND (dead IS NULL OR dead = false)
    ORDER BY id ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
