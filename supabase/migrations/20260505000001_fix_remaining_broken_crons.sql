-- Fix 3 remaining broken pg_cron jobs that use non-existent vault key names.
-- Original migration 20260423132536 used COALESCE(name='SUPABASE_SERVICE_ROLE_KEY', name='service_role_key')
-- — neither key exists in vault, so the bearer token resolves to NULL and every HTTP call fails silently.
DO $$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'
  LIMIT 1;

  -- hire-alert-scanner: healthcare vertical (5am UTC = 1am ET)
  PERFORM cron.unschedule('hire-alert-healthcare-1am-et');
  PERFORM cron.schedule(
    'hire-alert-healthcare-1am-et', '0 5 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{"vertical_filter":"healthcare","triggered_by":"cron_round_robin"}'::jsonb)$$,
      v_url || '/functions/v1/hire-alert-scanner', v_key)
  );

  -- hire-alert-scanner: industrial vertical (6am UTC = 2am ET)
  PERFORM cron.unschedule('hire-alert-industrial-2am-et');
  PERFORM cron.schedule(
    'hire-alert-industrial-2am-et', '0 6 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{"vertical_filter":"industrial","triggered_by":"cron_round_robin"}'::jsonb)$$,
      v_url || '/functions/v1/hire-alert-scanner', v_key)
  );

  -- industry-pulse-scanner: commercial (7am UTC = 3am ET)
  PERFORM cron.unschedule('industry-pulse-commercial-3am-et');
  PERFORM cron.schedule(
    'industry-pulse-commercial-3am-et', '0 7 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{"triggered_by":"cron_round_robin"}'::jsonb)$$,
      v_url || '/functions/v1/industry-pulse-scanner', v_key)
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fix_remaining_broken_crons: % — %', SQLERRM, SQLSTATE;
END $$;
