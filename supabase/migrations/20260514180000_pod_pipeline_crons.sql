-- POD pipeline cron jobs — runs daily UTC
-- 8am: multi-trend-scanner (Firecrawl scrape of 50 rotating sources)
-- 9am: etsy-trend-scanner (Etsy API v3 direct)
-- 10am: pod-design-generator (gpt-image-1 + Printify upload)
-- 11am: pod-publisher (Printify product create + Etsy publish)

SELECT cron.unschedule('multi-trend-scanner') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'multi-trend-scanner');
SELECT cron.schedule(
  'multi-trend-scanner',
  '0 8 * * *',
  $job$SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/multi-trend-scanner',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );$job$
);

SELECT cron.unschedule('etsy-trend-scanner') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'etsy-trend-scanner');
SELECT cron.schedule(
  'etsy-trend-scanner',
  '0 9 * * *',
  $job$SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/etsy-trend-scanner',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );$job$
);

SELECT cron.unschedule('pod-design-generator') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-design-generator');
SELECT cron.schedule(
  'pod-design-generator',
  '0 10 * * *',
  $job$SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/pod-design-generator',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );$job$
);

SELECT cron.unschedule('pod-publisher') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-publisher');
SELECT cron.schedule(
  'pod-publisher',
  '0 11 * * *',
  $job$SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/pod-publisher',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );$job$
);
