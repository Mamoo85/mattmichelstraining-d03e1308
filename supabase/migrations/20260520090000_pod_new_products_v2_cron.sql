-- pod-new-products v2 cron upgrade
-- Changes: Mon/Wed/Fri once/day → daily 5x/day (9,10,11,12,1pm UTC)
-- Each run picks 1 pending item from pod_product_queue.
-- First run of the day also fills the queue with 5 trend-driven products.
-- Net result: 5 products created per day, types chosen by etsy_pod_trends favorer count.

-- Remove old MWF-only schedule
SELECT cron.unschedule('pod-new-products-mwf')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-new-products-mwf');

-- Schedule 5 daily runs at 9,10,11,12,1pm UTC
SELECT cron.schedule(
  'pod-new-products-daily',
  '0 9-13 * * *',
  $job$SELECT net.http_post(
    url     := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/pod-new-products',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := '{}'::jsonb
  );$job$
);

-- Fix legacy "tote" queue items (tote blueprint was removed in v42)
-- Reassign to tshirt so they're not silently skipped forever
UPDATE pod_product_queue
SET product_type = 'tshirt'
WHERE product_type = 'tote' AND status = 'pending';
