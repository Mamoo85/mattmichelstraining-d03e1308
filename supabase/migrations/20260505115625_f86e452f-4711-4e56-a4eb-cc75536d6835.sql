-- Schedules cold-email pipeline crons that were missing.
-- Pattern matches Phase 43 fix (hardcoded URL + SUPABASE_SERVICE_ROLE_KEY_VAULT).

DO $$
DECLARE
  proj_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  svc_key  text := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT');
BEGIN
  -- Drop any prior versions so this migration is idempotent
  PERFORM cron.unschedule(jobname) FROM cron.job
  WHERE jobname IN (
    'techalert-enrich-2h',
    'techalert-outreach-3x',
    'techalert-followup-drip-2x',
    'outreach-email-blast-daily'
  );

  -- TechAlert / Talent Radar — Apollo+Hunter+Firecrawl drain (every 2h, 8am–8pm ET)
  PERFORM cron.schedule(
    'techalert-enrich-2h',
    '0 12,14,16,18,20,22,0 * * *',
    format($f$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L),
        body := '{}'::jsonb
      );
    $f$, proj_url || '/functions/v1/techalert-enrich', svc_key)
  );

  -- TechAlert / Talent Radar — Cold outreach (8am, 12pm, 4pm ET = 12:00, 16:00, 20:00 UTC)
  PERFORM cron.schedule(
    'techalert-outreach-3x',
    '0 12,16,20 * * *',
    format($f$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L),
        body := '{}'::jsonb
      );
    $f$, proj_url || '/functions/v1/techalert-outreach', svc_key)
  );

  -- TechAlert / Talent Radar — D3/D7/D14 drip (9am + 2pm ET)
  PERFORM cron.schedule(
    'techalert-followup-drip-2x',
    '0 13,18 * * *',
    format($f$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L),
        body := '{}'::jsonb
      );
    $f$, proj_url || '/functions/v1/techalert-followup-drip', svc_key)
  );

  -- Generic B2B blast (drains active outreach_campaigns rows) — 10am ET
  PERFORM cron.schedule(
    'outreach-email-blast-daily',
    '0 14 * * *',
    format($f$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %L),
        body := '{}'::jsonb
      );
    $f$, proj_url || '/functions/v1/outreach-email-blast', svc_key)
  );
END $$;