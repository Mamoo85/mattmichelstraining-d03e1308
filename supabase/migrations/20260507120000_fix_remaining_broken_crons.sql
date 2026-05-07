-- Fix all remaining broken pg_cron jobs from migrations 20260412 and 20260413.
-- Those migrations used vault keys that don't exist:
--   'SUPABASE_URL'          → vault key does not exist (returns NULL → cron fails)
--   'SUPABASE_SERVICE_ROLE_KEY' → vault key does not exist (returns NULL → 401)
-- Correct pattern: hardcoded URL + 'SUPABASE_SERVICE_ROLE_KEY_VAULT'
-- Template matches the working 20260505000000_fix_broken_cron_patterns.sql

DO $$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'
  LIMIT 1;

  -- ── From 20260413143053 — hire-alert, dead-lead, contractor, dwa agents ──

  PERFORM cron.unschedule('hire-alert-scanner-daily');
  PERFORM cron.schedule(
    'hire-alert-scanner-daily', '0 11 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/hire-alert-scanner', v_key)
  );

  PERFORM cron.unschedule('hire-alert-phantom-alert-daily');
  PERFORM cron.schedule(
    'hire-alert-phantom-alert-daily', '30 12 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/hire-alert-phantom-alert', v_key)
  );

  PERFORM cron.unschedule('hire-alert-trial-convert-daily');
  PERFORM cron.schedule(
    'hire-alert-trial-convert-daily', '0 14 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/hire-alert-trial-convert', v_key)
  );

  PERFORM cron.unschedule('dead-lead-drip-daily');
  PERFORM cron.schedule(
    'dead-lead-drip-daily', '0 14 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/dead-lead-drip', v_key)
  );

  PERFORM cron.unschedule('dead-lead-daily-notifier');
  PERFORM cron.schedule(
    'dead-lead-daily-notifier', '0 21 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/dead-lead-daily-notifier', v_key)
  );

  PERFORM cron.unschedule('dead-lead-outreach-drip-daily');
  PERFORM cron.schedule(
    'dead-lead-outreach-drip-daily', '0 16 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/dead-lead-outreach-drip', v_key)
  );

  PERFORM cron.unschedule('contractor-fomo-mailer-daily');
  PERFORM cron.schedule(
    'contractor-fomo-mailer-daily', '0 19 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/contractor-fomo-mailer', v_key)
  );

  PERFORM cron.unschedule('contractor-aged-lead-downsell-daily');
  PERFORM cron.schedule(
    'contractor-aged-lead-downsell-daily', '0 18 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/contractor-aged-lead-downsell', v_key)
  );

  PERFORM cron.unschedule('dwa-operator-4h');
  PERFORM cron.schedule(
    'dwa-operator-4h', '0 */4 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/dwa-operator', v_key)
  );

  PERFORM cron.unschedule('dwa-closer-daily');
  PERFORM cron.schedule(
    'dwa-closer-daily', '0 18 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/dwa-closer', v_key)
  );

  -- ── From 20260415040000 — compliance monitors ────────────────────────────

  PERFORM cron.unschedule('comply-monitor-daily');
  PERFORM cron.schedule(
    'comply-monitor-daily', '30 15 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/comply-monitor', v_key)
  );

  PERFORM cron.unschedule('mute-compliance-2h');
  PERFORM cron.schedule(
    'mute-compliance-2h', '0 */2 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/mute-compliance-monitor', v_key)
  );

  -- ── From 20260412000000 — Wave 4 product crons ───────────────────────────

  PERFORM cron.unschedule('storm-lead-blaster');
  PERFORM cron.schedule(
    'storm-lead-blaster', '*/30 * * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/storm-lead-blaster', v_key)
  );

  PERFORM cron.unschedule('recall-alert-checker');
  PERFORM cron.schedule(
    'recall-alert-checker', '0 13 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/recall-alert-checker', v_key)
  );

  PERFORM cron.unschedule('permit-watch-scanner');
  PERFORM cron.schedule(
    'permit-watch-scanner', '0 12 * * 1-5',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/permit-watch-scanner', v_key)
  );

  PERFORM cron.unschedule('website-speed-audit');
  PERFORM cron.schedule(
    'website-speed-audit', '0 11 1 * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/website-speed-audit', v_key)
  );

  PERFORM cron.unschedule('bedtime-story-sender');
  PERFORM cron.schedule(
    'bedtime-story-sender', '0 23 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/bedtime-story-sender', v_key)
  );

  PERFORM cron.unschedule('crime-digest-sender');
  PERFORM cron.schedule(
    'crime-digest-sender', '0 12 * * 1',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/crime-digest-sender', v_key)
  );

  PERFORM cron.unschedule('license-expiry-checker');
  PERFORM cron.schedule(
    'license-expiry-checker', '0 13 * * *',
    format($$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'), body := '{}'::jsonb)$$,
      v_url || '/functions/v1/license-expiry-checker', v_key)
  );

END $$;
