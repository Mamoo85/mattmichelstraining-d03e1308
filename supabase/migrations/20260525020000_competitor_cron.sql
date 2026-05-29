-- competitor_cron — pg_cron schedule for shop-intelligence nightly run
-- Runs at 4:59am UTC (11:59pm EST) — before any morning digest jobs

SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'shop-intelligence-nightly';
SELECT cron.schedule(
  'shop-intelligence-nightly',
  '59 4 * * *',
  'SELECT net.http_post(url:=''https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/shop-intelligence'',headers:=''{"Content-Type":"application/json"}''::jsonb,body:=''{}''::jsonb)'
);
