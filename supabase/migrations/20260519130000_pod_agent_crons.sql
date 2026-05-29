-- POD business agent cron schedules
-- All times UTC. Uses pg_cron + pg_net (already enabled in this project).
--
-- Agent schedule overview:
--   9am  Mon/Wed/Fri  pod-new-products  — creates 1 product from pod_product_queue
--   12pm daily        pod-autopilot     — publishes unpublished, deduplicates
--   2pm  daily        pod-seo-agent     — SEO-refreshes 5 listings (rolling 30-day sweep)

-- pod-new-products: Mon/Wed/Fri at 9am UTC
SELECT cron.unschedule('pod-new-products-mwf')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-new-products-mwf');

SELECT cron.schedule(
  'pod-new-products-mwf',
  '0 9 * * 1,3,5',
  $job$SELECT net.http_post(
    url     := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/pod-new-products',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := '{}'::jsonb
  );$job$
);

-- pod-autopilot: every day at 12pm UTC
SELECT cron.unschedule('pod-autopilot-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-autopilot-daily');

SELECT cron.schedule(
  'pod-autopilot-daily',
  '0 12 * * *',
  $job$SELECT net.http_post(
    url     := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/pod-autopilot',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := '{}'::jsonb
  );$job$
);

-- pod-seo-agent: every day at 2pm UTC (5 listings/day → full sweep in ~30 days)
SELECT cron.unschedule('pod-seo-agent-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-seo-agent-daily');

SELECT cron.schedule(
  'pod-seo-agent-daily',
  '0 14 * * *',
  $job$SELECT net.http_post(
    url     := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/pod-seo-agent',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := '{}'::jsonb
  );$job$
);
