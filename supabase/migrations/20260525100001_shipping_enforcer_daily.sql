-- Phase 79 remaining — Part 3: Free shipping enforcer daily cadence
-- Currently weekly (Monday 8am) — new listings created Tue–Sun go up to 6 days
-- without the free-shipping profile, which costs search ranking on Etsy.
-- Changed to: daily 11am UTC (after pod-publisher at 11am, before pod-seo-agent at 2pm).

SELECT cron.unschedule(jobname)
  FROM cron.job WHERE jobname = 'etsy-free-shipping-enforcer-weekly';

SELECT cron.unschedule(jobname)
  FROM cron.job WHERE jobname = 'etsy-free-shipping-enforcer-daily';

SELECT cron.schedule(
  'etsy-free-shipping-enforcer-daily',
  '30 11 * * *',  -- 11:30am UTC daily — 30 min after pod-publisher finishes
  'SELECT net.http_post(
    url    := ''https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/etsy-free-shipping-enforcer'',
    headers := ''{"Content-Type":"application/json"}''::jsonb,
    body   := ''{}''::jsonb
  )'
);

-- Verify
SELECT jobname, schedule FROM cron.job WHERE jobname LIKE '%free-shipping%';
