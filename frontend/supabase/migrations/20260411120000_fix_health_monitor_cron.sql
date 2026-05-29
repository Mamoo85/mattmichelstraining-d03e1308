-- Fix contractor-lead-health-monitor cron
-- The original migration used current_setting('app.settings.supabase_url') which
-- is not configured on most projects. Re-create using vault.decrypted_secrets
-- to match the pattern used by working contractor crons.

-- Drop the broken cron if it somehow exists
SELECT cron.unschedule('contractor-lead-health-monitor')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'contractor-lead-health-monitor');

-- Re-create using vault approach (consistent with contractor-prospector-daily pattern)
SELECT cron.schedule(
  'contractor-lead-health-monitor',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/contractor-lead-health-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  )
  $$
);
