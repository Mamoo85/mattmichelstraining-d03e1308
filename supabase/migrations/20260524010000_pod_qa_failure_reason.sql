-- Phase 74: Add qa_failure_reason column to pod_product_queue
-- Stores the human-readable reason when a visual QA check fails,
-- enabling audit trail and prompt tuning.
ALTER TABLE pod_product_queue
  ADD COLUMN IF NOT EXISTS qa_failure_reason TEXT;

COMMENT ON COLUMN pod_product_queue.qa_failure_reason IS
  'Human-readable reason for visual QA failure (e.g. "blank upper leg visible", "split left/right design"). Populated by vision gate checks.';
