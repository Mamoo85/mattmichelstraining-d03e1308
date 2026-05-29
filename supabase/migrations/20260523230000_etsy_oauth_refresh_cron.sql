-- Schedule Etsy OAuth token refresh every 12 hours (2am and 2pm UTC)
-- Targets SECONDARY project (zmyczlfuufhngzovkjdh) because etsy_oauth_tokens
-- lives there alongside the POD pipeline functions (etsy-digital-uploader, etc.)
-- This cron runs on PRIMARY project's pg_cron but calls SECONDARY's edge function,
-- which refreshes the token in the secondary project's etsy_oauth_tokens table.
DO $migration$
DECLARE
  v_url text := 'https://zmyczlfuufhngzovkjdh.supabase.co';
  v_key text := 'eyJ.REDACTED.JWT';
  v_hdr text;
BEGIN
  v_hdr := json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text;
  PERFORM cron.unschedule('etsy-oauth-refresh-12h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='etsy-oauth-refresh-12h');
  PERFORM cron.schedule(
    'etsy-oauth-refresh-12h',
    '0 2,14 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/etsy-oauth-refresh', v_hdr)
  );
END $migration$;
