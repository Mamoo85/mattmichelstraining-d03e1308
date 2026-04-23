-- New Business Owner Radar — daily cron at 8am ET
-- Scans Michigan SOS new LLC registrations and routes them to cold outreach pipeline.
-- Uses vault pattern (not current_setting) to avoid NULL in pg_cron context.

select
  cron.schedule(
    'new-business-radar-daily',
    '0 12 * * *',  -- 8am ET = 12pm UTC
    $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_URL') || '/functions/v1/new-business-radar',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY') || '"}'::jsonb,
      body := '{}'::jsonb
    );
    $$
  );
