-- Fix 12 broken pg_cron jobs that use non-existent vault key names
-- ('SUPABASE_URL' and 'SUPABASE_SERVICE_ROLE_KEY' do not exist in vault).
-- Correct pattern: hardcoded URL + SUPABASE_SERVICE_ROLE_KEY_VAULT.
-- Also adds the missing trade-radar-am-digest-daily cron (was never scheduled).
DO $$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'
  LIMIT 1;

  -- ── Phase 23 crons (from 20260426020000_phase23_crons.sql) ─────────────

  PERFORM cron.unschedule('callback-reminder-sender-5min');
  PERFORM cron.schedule(
    'callback-reminder-sender-5min', '*/5 * * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/callback-reminder-sender', v_key)
  );

  PERFORM cron.unschedule('site-radar-repeat-alert-hourly');
  PERFORM cron.schedule(
    'site-radar-repeat-alert-hourly', '0 * * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/site-radar-repeat-alert', v_key)
  );

  PERFORM cron.unschedule('site-radar-weekly-digest-monday');
  PERFORM cron.schedule(
    'site-radar-weekly-digest-monday', '0 11 * * 1',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/site-radar-weekly-digest', v_key)
  );

  PERFORM cron.unschedule('site-radar-health-check-daily');
  PERFORM cron.schedule(
    'site-radar-health-check-daily', '0 9 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/site-radar-health-check', v_key)
  );

  PERFORM cron.unschedule('nps-survey-sender-daily');
  PERFORM cron.schedule(
    'nps-survey-sender-daily', '0 13 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/nps-survey-sender', v_key)
  );

  PERFORM cron.unschedule('missed-call-escalation-30min');
  PERFORM cron.schedule(
    'missed-call-escalation-30min', '*/30 * * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/missed-call-escalation', v_key)
  );

  -- ── Phase 18 crons (from 20260418004827) ───────────────────────────────

  PERFORM cron.unschedule('demand-radar-digest-daily');
  PERFORM cron.schedule(
    'demand-radar-digest-daily', '0 11 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{"source":"cron"}'::jsonb)$$,
      v_url || '/functions/v1/demand-radar-digest', v_key)
  );

  PERFORM cron.unschedule('hire-alert-phantom-alert-daily');
  PERFORM cron.schedule(
    'hire-alert-phantom-alert-daily', '30 12 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{"source":"cron"}'::jsonb)$$,
      v_url || '/functions/v1/hire-alert-phantom-alert', v_key)
  );

  PERFORM cron.unschedule('hire-alert-scanner-daily');
  PERFORM cron.schedule(
    'hire-alert-scanner-daily', '0 11 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{"source":"cron"}'::jsonb)$$,
      v_url || '/functions/v1/hire-alert-scanner', v_key)
  );

  PERFORM cron.unschedule('techalert-weekly-digest-monday');
  PERFORM cron.schedule(
    'techalert-weekly-digest-monday', '0 13 * * 1',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{"source":"cron"}'::jsonb)$$,
      v_url || '/functions/v1/techalert-weekly-digest', v_key)
  );

  -- ── Early crons (from 20260413000000 — used wrong key names) ───────────

  PERFORM cron.unschedule('dead-lead-drip');
  PERFORM cron.schedule(
    'dead-lead-drip', '0 14 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/dead-lead-drip', v_key)
  );

  PERFORM cron.unschedule('contractor-roi-sms');
  PERFORM cron.schedule(
    'contractor-roi-sms', '0 13 * * 5',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/contractor-roi-sms', v_key)
  );

  -- ── NEW: trade-radar-am-digest (was never scheduled) ───────────────────
  -- 13:30 UTC = 9:30am EDT — runs 30 min after trade-radar-scanner at 13:00 UTC

  PERFORM cron.unschedule('trade-radar-am-digest-daily');
  PERFORM cron.schedule(
    'trade-radar-am-digest-daily', '30 13 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/trade-radar-am-digest', v_key)
  );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fix_broken_cron_patterns: % — %', SQLERRM, SQLSTATE;
END $$;
