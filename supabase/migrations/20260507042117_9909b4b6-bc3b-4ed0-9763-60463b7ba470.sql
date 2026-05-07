-- Backfill: mark historical invoice.* rows in processed_stripe_events as completed.
-- These are recurring billing events that don't require fulfillment work.
-- The webhook code now stamps them at receipt; this fixes pre-fix rows.
UPDATE public.processed_stripe_events
SET fulfillment_status = 'completed',
    fulfillment_completed_at = COALESCE(fulfillment_completed_at, now())
WHERE fulfillment_status = 'pending'
  AND event_type LIKE 'invoice.%';
