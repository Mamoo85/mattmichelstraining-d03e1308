-- ============================================================
-- REFERRAL ASK CRON
-- Runs 1st of every month at 9am ET (13:00 UTC)
-- Emails active clients who joined ~30 days ago asking for referrals
-- ============================================================

SELECT cron.schedule(
  'referral-ask-monthly',
  '0 13 1 * *',
  $$
  SELECT extensions.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/referral-ask-sender',
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
