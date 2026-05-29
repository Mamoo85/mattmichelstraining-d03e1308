-- pod-revenue-digest cron: daily at 7am UTC (before all other POD crons)
-- Sends SMS digest of yesterday's Etsy revenue to Matt.

SELECT cron.unschedule('pod-revenue-digest')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-revenue-digest');

SELECT cron.schedule(
  'pod-revenue-digest',
  '0 7 * * *',
  $job$SELECT net.http_post(
    url     := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/pod-revenue-digest',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body    := '{}'::jsonb
  );$job$
);
