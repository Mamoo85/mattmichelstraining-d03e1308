-- missed-call-prospect-scanner: daily 8am ET (12:00 UTC)
-- Scans LARA COFS for newly issued cosmetology/dental/PT/vet licenses
-- and Google Maps for businesses in hot counties, writes to outreach_leads.
-- Runs before dwa-product-blast (11am ET / 15:00 UTC).

DO $$
DECLARE
  v_url  text := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/missed-call-prospect-scanner';
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

  PERFORM cron.unschedule('missed-call-prospect-scanner-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'missed-call-prospect-scanner-daily');

  PERFORM cron.schedule(
    'missed-call-prospect-scanner-daily',
    '0 12 * * *',
    format(
      $$SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:='{}')$$,
      v_url, v_hdr
    )
  );
END $$;
