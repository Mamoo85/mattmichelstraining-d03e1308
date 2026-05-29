-- ============================================================
-- AGENT SMITH: Daily Business Report Cron
-- Runs every day at 7am ET (11:00 UTC)
-- Emails Matt a full business health report:
-- revenue snapshot, actions needed, automated tasks completed
-- ============================================================

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('agent-smith-daily-report');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

SELECT cron.schedule(
  'agent-smith-daily-report',
  '0 11 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/agent-smith-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key' LIMIT 1
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
