-- POD Pipeline v2 upgrade crons
-- New scheduled jobs for the 20 upgrade edge functions.
-- All crons use pg_cron + pg_net (already enabled).

DO $migration$
DECLARE
  v_url text := 'https://zmyczlfuufhngzovkjdh.supabase.co';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT';
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'vault key missing'; END IF;

  -- pod-listing-health-check: daily 6am UTC (first cron — detects removals before anything else runs)
  PERFORM cron.unschedule('pod-listing-health-check-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-listing-health-check-daily');
  PERFORM cron.schedule(
    'pod-listing-health-check-daily', '0 6 * * *',
    format($job$SELECT net.http_post(url:=%L,headers:=%L::jsonb,body:='{}'::jsonb);$job$,
      v_url || '/functions/v1/pod-listing-health-check',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text)
  );

  -- pod-price-spy: daily 8am UTC (before pod-new-products so prices are fresh)
  PERFORM cron.unschedule('pod-price-spy-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-price-spy-daily');
  PERFORM cron.schedule(
    'pod-price-spy-daily', '0 8 * * *',
    format($job$SELECT net.http_post(url:=%L,headers:=%L::jsonb,body:='{}'::jsonb);$job$,
      v_url || '/functions/v1/pod-price-spy',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text)
  );

  -- pod-sales-velocity-tracker: daily 8:30am UTC
  PERFORM cron.unschedule('pod-sales-velocity-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-sales-velocity-daily');
  PERFORM cron.schedule(
    'pod-sales-velocity-daily', '30 8 * * *',
    format($job$SELECT net.http_post(url:=%L,headers:=%L::jsonb,body:='{}'::jsonb);$job$,
      v_url || '/functions/v1/pod-sales-velocity-tracker',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text)
  );

  -- pod-stats-collector: daily 7am UTC (reads Etsy listing stats)
  PERFORM cron.unschedule('pod-stats-collector-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-stats-collector-daily');
  PERFORM cron.schedule(
    'pod-stats-collector-daily', '0 7 * * *',
    format($job$SELECT net.http_post(url:=%L,headers:=%L::jsonb,body:='{}'::jsonb);$job$,
      v_url || '/functions/v1/pod-stats-collector',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text)
  );

  -- pod-retry-handler: every 2 hours (dead letter queue auto-retry)
  PERFORM cron.unschedule('pod-retry-handler-2h')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-retry-handler-2h');
  PERFORM cron.schedule(
    'pod-retry-handler-2h', '0 */2 * * *',
    format($job$SELECT net.http_post(url:=%L,headers:=%L::jsonb,body:='{}'::jsonb);$job$,
      v_url || '/functions/v1/pod-retry-handler',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text)
  );

  -- pod-niche-discoverer: weekly Monday 8am UTC (runs before etsy-trend-scanner at 9am)
  PERFORM cron.unschedule('pod-niche-discoverer-weekly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-niche-discoverer-weekly');
  PERFORM cron.schedule(
    'pod-niche-discoverer-weekly', '0 8 * * 1',
    format($job$SELECT net.http_post(url:=%L,headers:=%L::jsonb,body:='{}'::jsonb);$job$,
      v_url || '/functions/v1/pod-niche-discoverer',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text)
  );

  -- pod-reddit-scanner: weekly Wednesday 8am UTC
  PERFORM cron.unschedule('pod-reddit-scanner-weekly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-reddit-scanner-weekly');
  PERFORM cron.schedule(
    'pod-reddit-scanner-weekly', '0 8 * * 3',
    format($job$SELECT net.http_post(url:=%L,headers:=%L::jsonb,body:='{}'::jsonb);$job$,
      v_url || '/functions/v1/pod-reddit-scanner',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text)
  );

  -- pod-tag-entropy-checker: weekly Sunday 8am UTC
  PERFORM cron.unschedule('pod-tag-entropy-weekly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-tag-entropy-weekly');
  PERFORM cron.schedule(
    'pod-tag-entropy-weekly', '0 8 * * 0',
    format($job$SELECT net.http_post(url:=%L,headers:=%L::jsonb,body:='{}'::jsonb);$job$,
      v_url || '/functions/v1/pod-tag-entropy-checker',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text)
  );

  -- pod-ab-resolver: bi-weekly Tuesday 9am UTC (resolves A/B image + title tests)
  PERFORM cron.unschedule('pod-ab-resolver-biweekly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-ab-resolver-biweekly');
  PERFORM cron.schedule(
    'pod-ab-resolver-biweekly', '0 9 * * 2',
    format($job$SELECT net.http_post(url:=%L,headers:=%L::jsonb,body:='{}'::jsonb);$job$,
      v_url || '/functions/v1/pod-ab-resolver',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text)
  );

  -- pod-provider-optimizer: monthly on 1st at 6am UTC
  PERFORM cron.unschedule('pod-provider-optimizer-monthly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-provider-optimizer-monthly');
  PERFORM cron.schedule(
    'pod-provider-optimizer-monthly', '0 6 1 * *',
    format($job$SELECT net.http_post(url:=%L,headers:=%L::jsonb,body:='{}'::jsonb);$job$,
      v_url || '/functions/v1/pod-provider-optimizer',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text)
  );

  -- pattern-generation-pipeline: daily 7am UTC (before trend scanner)
  PERFORM cron.unschedule('pattern-generation-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pattern-generation-daily');
  PERFORM cron.schedule(
    'pattern-generation-daily', '0 7 * * *',
    format($job$SELECT net.http_post(url:=%L,headers:=%L::jsonb,body:='{}'::jsonb);$job$,
      v_url || '/functions/v1/pattern-generation-pipeline',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text)
  );

  -- pod-outreach-scheduler: weekdays 8am UTC (B2B cold email — 20/day cap)
  PERFORM cron.unschedule('pod-outreach-weekdays')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-outreach-weekdays');
  PERFORM cron.schedule(
    'pod-outreach-weekdays', '0 8 * * 1-5',
    format($job$SELECT net.http_post(url:=%L,headers:=%L::jsonb,body:='{}'::jsonb);$job$,
      v_url || '/functions/v1/pod-outreach-scheduler',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text)
  );

END $migration$;
