-- Fix: Etsy OAuth token cadence — was 2× per day, tokens expire hourly.
-- A single failed 2am refresh = 11-hour dead Etsy pipeline with no alert.
-- New cadence: every 55 minutes. The edge function has a validity-window guard
-- that skips the actual refresh if the current token still has >10 minutes left,
-- so this is cheap (one DB read) when the token is healthy.
-- Targets SECONDARY project (zmyczlfuufhngzovkjdh) where etsy_oauth_tokens lives.

DO $migration$
DECLARE
  v_url text := 'https://zmyczlfuufhngzovkjdh.supabase.co';
  v_key text := 'eyJ.REDACTED.JWT';
  v_hdr text;
BEGIN
  v_hdr := json_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_key
  )::text;

  -- Remove the old 12-hour cron
  PERFORM cron.unschedule('etsy-oauth-refresh-12h')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'etsy-oauth-refresh-12h');

  -- Schedule every 55 minutes. The edge function skips the actual refresh
  -- if expires_at is still > 10 min away, so this is a cheap no-op most runs.
  PERFORM cron.schedule(
    'etsy-oauth-refresh-55m',
    '*/55 * * * *',
    format(
      $job$SELECT net.http_post(
        url    := %L,
        headers := %L::jsonb,
        body   := '{}'::jsonb
      );$job$,
      v_url || '/functions/v1/etsy-oauth-refresh',
      v_hdr
    )
  );

  RAISE NOTICE 'etsy-oauth-refresh cron updated: 12h → 55min cadence';
END $migration$;
