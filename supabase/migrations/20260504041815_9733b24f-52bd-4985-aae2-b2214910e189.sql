-- Fix 4 broken pg_cron jobs identified in audit (2026-05-04)
-- Issue 1-3: jobs reference vault secrets 'project_url' and 'service_role_key' that don't exist.
--           Pattern across the rest of the codebase uses hardcoded supabase URL + SUPABASE_SERVICE_ROLE_KEY_VAULT.
-- Issue 4: vacuum-enrichment-tables-nightly fails because VACUUM cannot run inside cron's transaction wrapper.

-- 1) release-pending-sms-every-minute (1440 fails/day - the worst offender)
SELECT cron.unschedule('release-pending-sms-every-minute');
SELECT cron.schedule(
  'release-pending-sms-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/release-pending-sms',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 2) marketplace-lead-free-enrich-hourly
SELECT cron.unschedule('marketplace-lead-free-enrich-hourly');
SELECT cron.schedule(
  'marketplace-lead-free-enrich-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/marketplace-lead-free-enrich-batch',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 3) postcard-offer-digest-daily
SELECT cron.unschedule('postcard-offer-digest-daily');
SELECT cron.schedule(
  'postcard-offer-digest-daily',
  '15 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/postcard-offer-digest',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 4) vacuum-enrichment-tables-nightly: drop the VACUUM statements (cannot run inside cron's tx).
--    Keep the cache-cleanup DELETEs which are the actually useful part. Postgres autovacuum handles vacuum.
SELECT cron.unschedule('vacuum-enrichment-tables-nightly');
SELECT cron.schedule(
  'cleanup-enrichment-caches-nightly',
  '0 9 * * *',
  $$
  DELETE FROM public.scrape_raw_cache WHERE expires_at < now();
  DELETE FROM public.pdl_negative_cache WHERE expires_at < now();
  DELETE FROM public.llm_response_cache WHERE expires_at < now();
  $$
);
