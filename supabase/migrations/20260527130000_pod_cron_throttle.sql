-- Migration: 20260527130000_pod_cron_throttle.sql
-- Throttle pod-new-products from 5 runs/day to 1 run/day.
-- Old schedule: 0 9-13 * * *  (runs hourly from 9am–1pm UTC = 5 runs/day)
-- New schedule: 0 9 * * *     (runs once at 9am UTC only)
--
-- Rationale: We have 647 published listings with 0 sales. Stop diluting distribution.
-- Concentrate distribution on hero set before adding more products.
--
-- Pattern: unschedule first (never ON CONFLICT), then reschedule.
-- Applied manually to SECONDARY project (zmyczlfuufhngzovkjdh) — CI/CD only touches PRIMARY.

-- Remove all pod-new-products cron entries (covers 'pod-new-products-daily' and any legacy names)
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname LIKE 'pod-new-products%';

-- Schedule 1 daily run at 9am UTC
SELECT cron.schedule(
  'pod-new-products-daily',
  '0 9 * * *',
  $job$SELECT net.http_post(
    url     := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/pod-new-products',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := '{}'::jsonb
  );$job$
);
