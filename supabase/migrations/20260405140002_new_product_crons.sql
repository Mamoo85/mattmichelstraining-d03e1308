-- ============================================================
-- CRON JOBS: Regulatory Filing Monitor + Bid Intelligence
-- All times in UTC. ET = UTC-4 (EDT).
-- ============================================================

-- Reg Filing Scan — Daily 6am ET (10:00 UTC)
SELECT cron.schedule('reg-filing-scan-daily', '0 10 * * *', $$
  SELECT extensions.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/reg-filing-scan',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);

-- Reg Filing Deadline Check — Daily 8am ET (12:00 UTC)
SELECT cron.schedule('reg-filing-deadline-check', '0 12 * * *', $$
  SELECT extensions.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/reg-filing-scan',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{"mode":"deadline_check"}'::jsonb) AS request_id; $$);

-- Bid Intel Scan — Daily 7am ET (11:00 UTC)
SELECT cron.schedule('bid-intel-scan-daily', '0 11 * * *', $$
  SELECT extensions.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/bid-intel-scan',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);

-- Morning Digest — Daily 7am ET (11:00 UTC)
SELECT cron.schedule('morning-digest-daily', '30 10 * * *', $$
  SELECT extensions.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/morning-digest',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);
