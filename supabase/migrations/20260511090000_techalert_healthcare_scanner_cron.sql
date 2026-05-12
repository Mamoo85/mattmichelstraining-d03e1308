-- techalert-healthcare-scanner cron — daily 9am ET (13:00 UTC)
-- Scans LARA for new nursing licenses + Google Maps for nursing home prospects
-- Must run BEFORE techalert-enrich (10am) and techalert-outreach (11am) so
-- healthcare prospects are enriched and emailed the same day they're discovered.
--
-- Uses the confirmed-working DO-block vault pattern from 20260507120000_fix_remaining_broken_crons.sql
-- (inline subquery inside cron body fails at execution time in some Postgres versions)

DO $$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'
  LIMIT 1;

  PERFORM cron.unschedule('techalert-healthcare-scanner-daily');
  PERFORM cron.schedule(
    'techalert-healthcare-scanner-daily',
    '0 13 * * *',
    format(
      $$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/techalert-healthcare-scanner',
      v_key
    )
  );
END $$;
