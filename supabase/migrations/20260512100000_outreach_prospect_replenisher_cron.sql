-- outreach-prospect-replenisher: daily 5am ET (9:00 UTC)
-- Fills outreach_leads with 500 fresh prospects from Google Maps,
-- BSEED certified contractors, and SAM.gov MI entities.
-- Runs before dwa-product-blast (11am ET / 15:00 UTC) so leads are ready.

DO $$
DECLARE
  v_url  text := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/outreach-prospect-replenisher';
  v_hdr  jsonb;
BEGIN
  SELECT jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || decrypted_secret
  )
  INTO v_hdr
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'
  LIMIT 1;

  PERFORM cron.unschedule('outreach-prospect-replenisher-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'outreach-prospect-replenisher-daily');

  PERFORM cron.schedule(
    'outreach-prospect-replenisher-daily',
    '0 9 * * *',
    format(
      $$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}')$$,
      v_url, v_hdr
    )
  );
END $$;
