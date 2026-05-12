-- Mortgage Radar LO cold email pipeline (find → enrich → blast)
DO $$
DECLARE
  base_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  vault_sql text := '(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name IN (''SUPABASE_SERVICE_ROLE_KEY_VAULT'',''service_role_key'',''SUPABASE_SERVICE_ROLE_KEY'') ORDER BY name LIMIT 1)';
BEGIN
  PERFORM cron.unschedule('mortgage-radar-find-lo-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mortgage-radar-find-lo-daily');
  PERFORM cron.schedule(
    'mortgage-radar-find-lo-daily',
    '0 14 * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %s),
        body := '{}'::jsonb
      )
    $job$, base_url || '/functions/v1/find-lo-prospects', vault_sql)
  );

  PERFORM cron.unschedule('mortgage-radar-enrich-lo-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mortgage-radar-enrich-lo-daily');
  PERFORM cron.schedule(
    'mortgage-radar-enrich-lo-daily',
    '30 14 * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %s),
        body := '{"limit": 50}'::jsonb
      )
    $job$, base_url || '/functions/v1/enrich-lo-prospect', vault_sql)
  );

  PERFORM cron.unschedule('mortgage-radar-lo-blast-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mortgage-radar-lo-blast-daily');
  PERFORM cron.schedule(
    'mortgage-radar-lo-blast-daily',
    '0 16 * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || %s),
        body := '{}'::jsonb
      )
    $job$, base_url || '/functions/v1/mortgage-radar-lo-blast', vault_sql)
  );
END $$;