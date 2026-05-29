-- ═══════════════════════════════════════════════════════════════════════════
-- FIX BROKEN CRONS
-- All migrations that used current_setting('app.supabase_url') or
-- current_setting('app.service_role_key') produced NULL URLs because
-- those GUC settings are never configured in pg_cron context.
-- This migration drops and recreates all affected crons using vault.decrypted_secrets.
-- ═══════════════════════════════════════════════════════════════════════════

-- Helper: safely unschedule if exists
DO $$
DECLARE
  jobs text[] := ARRAY[
    'oracle-monitor-daily', 'neo-outreach-daily', 'han-upsell-hourly',
    'luke-recovery-hourly', 'leia-onboard-daily', 'r2-watchdog-bihourly',
    'yoda-retain-daily', 'morpheus-demand-weekly',
    'comply-monitor-daily', 'cashier-dunning-daily', 'shield-winback-daily', 'nova-onboarding-daily',
    'contractor-aged-lead-downsell',
    'dead-lead-drip', 'contractor-roi-sms',
    'dead-lead-outreach-drip', 'dead-lead-daily-notifier',
    'dwa-operator-4h', 'dwa-closer-daily',
    'license-expiry-checker-daily'
  ];
  j text;
BEGIN
  FOREACH j IN ARRAY jobs LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = j) THEN
      PERFORM cron.unschedule(j);
    END IF;
  END LOOP;
END $$;

-- ── oracle-monitor-daily: 6am ET = 10:00 UTC ──────────────────────────────
SELECT cron.schedule(
  'oracle-monitor-daily', '0 10 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/oracle-monitor',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── neo-outreach-daily: 2pm ET = 18:00 UTC ────────────────────────────────
SELECT cron.schedule(
  'neo-outreach-daily', '0 18 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/neo-outreach',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── han-upsell-hourly: every 4 hours ──────────────────────────────────────
SELECT cron.schedule(
  'han-upsell-hourly', '0 */4 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/han-upsell',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── luke-recovery-hourly: every hour at :30 ───────────────────────────────
SELECT cron.schedule(
  'luke-recovery-hourly', '30 * * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/luke-recovery',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── leia-onboard-daily: 9am ET = 13:00 UTC ────────────────────────────────
SELECT cron.schedule(
  'leia-onboard-daily', '0 13 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/leia-onboard',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── r2-watchdog-bihourly: every 2 hours ───────────────────────────────────
SELECT cron.schedule(
  'r2-watchdog-bihourly', '0 */2 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/r2-watchdog',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── yoda-retain-daily: 10am ET = 14:00 UTC ────────────────────────────────
SELECT cron.schedule(
  'yoda-retain-daily', '0 14 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/yoda-retain',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── morpheus-demand-weekly: Sunday 8am ET = 12:00 UTC ─────────────────────
SELECT cron.schedule(
  'morpheus-demand-weekly', '0 12 * * 0',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/morpheus-demand',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── comply-monitor-daily: 7am ET = 11:00 UTC ──────────────────────────────
SELECT cron.schedule(
  'comply-monitor-daily', '0 11 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/comply-monitor',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── cashier-dunning-daily: 8am ET = 12:00 UTC ─────────────────────────────
SELECT cron.schedule(
  'cashier-dunning-daily', '0 12 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/cashier-dunning',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── shield-winback-daily: 9am ET = 13:00 UTC ──────────────────────────────
SELECT cron.schedule(
  'shield-winback-daily', '0 13 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/shield-winback',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── nova-onboarding-daily: 10am ET = 14:00 UTC ────────────────────────────
SELECT cron.schedule(
  'nova-onboarding-daily', '0 14 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/nova-onboarding',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── contractor-aged-lead-downsell: 2pm ET = 19:00 UTC ─────────────────────
SELECT cron.schedule(
  'contractor-aged-lead-downsell', '0 19 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/contractor-aged-lead-downsell',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── dead-lead-drip: 10am ET = 14:00 UTC ───────────────────────────────────
SELECT cron.schedule(
  'dead-lead-drip', '0 14 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/dead-lead-drip',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── contractor-roi-sms: Fridays 9am ET = 13:00 UTC ────────────────────────
SELECT cron.schedule(
  'contractor-roi-sms', '0 13 * * 5',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/contractor-roi-sms',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── dead-lead-outreach-drip: noon ET = 16:00 UTC ──────────────────────────
SELECT cron.schedule(
  'dead-lead-outreach-drip', '0 16 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/dead-lead-outreach-drip',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── dead-lead-daily-notifier: 5pm ET = 21:00 UTC ─────────────────────────
SELECT cron.schedule(
  'dead-lead-daily-notifier', '0 21 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/dead-lead-daily-notifier',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── dwa-operator-4h: every 4h ─────────────────────────────────────────────
SELECT cron.schedule(
  'dwa-operator-4h', '0 0,4,8,12,16,20 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/dwa-operator',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;

-- ── dwa-closer-daily: 2pm ET = 18:00 UTC ─────────────────────────────────
SELECT cron.schedule(
  'dwa-closer-daily', '0 18 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/dwa-closer',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')),
    body := '{}'::jsonb)$$
) ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command;
