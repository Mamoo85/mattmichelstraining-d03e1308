-- ============================================================
-- CRON JOBS FOR 20 NEW BUSINESSES
-- All times in UTC. ET = UTC-4 (EDT).
-- ============================================================

-- AI Competitor Watch — Weekly Friday 9am ET (13:00 UTC)
SELECT cron.schedule('competitor-watch-weekly', '0 13 * * 5', $$
  SELECT extensions.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ai-competitor-watch',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);

-- Appointment Reminder — Hourly
SELECT cron.schedule('appointment-reminders-hourly', '0 * * * *', $$
  SELECT extensions.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/appointment-reminder-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);

-- AI Video Scripts — Monthly 1st at 10am ET (14:00 UTC)
SELECT cron.schedule('video-scripts-monthly', '0 14 1 * *', $$
  SELECT extensions.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ai-video-script-writer',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);

-- AI Local SEO Pages — Monthly 3rd at 10am ET (14:00 UTC)
SELECT cron.schedule('local-seo-monthly', '0 14 3 * *', $$
  SELECT extensions.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ai-local-seo-writer',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);

-- Google Q&A Manager — Weekly Wednesday 10am ET (14:00 UTC)
SELECT cron.schedule('google-qa-weekly', '0 14 * * 3', $$
  SELECT extensions.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ai-google-qa-manager',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);

-- Staff Newsletter — Weekly Monday 8am ET (12:00 UTC)
SELECT cron.schedule('staff-newsletter-weekly', '0 12 * * 1', $$
  SELECT extensions.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/staff-newsletter-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);

-- Welcome Drip — Hourly (checks for due emails)
SELECT cron.schedule('welcome-drip-hourly', '30 * * * *', $$
  SELECT extensions.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/welcome-drip-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);

-- Promo Planner — Monthly 1st at 9am ET (13:00 UTC)
SELECT cron.schedule('promo-planner-monthly', '0 13 1 * *', $$
  SELECT extensions.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/promo-planner-generator',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);

-- Reactivation Emails — Monthly 5th at 10am ET (14:00 UTC)
SELECT cron.schedule('reactivation-monthly', '0 14 5 * *', $$
  SELECT extensions.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/reactivation-email-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);

-- AI Sales Scripts — Monthly 1st at 11am ET (15:00 UTC)
SELECT cron.schedule('sales-scripts-monthly', '0 15 1 * *', $$
  SELECT extensions.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ai-sales-script-writer',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);

-- AI Direct Mail — Monthly 2nd at 10am ET (14:00 UTC)
SELECT cron.schedule('direct-mail-monthly', '0 14 2 * *', $$
  SELECT extensions.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ai-direct-mail-writer',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);

-- Warranty Reminders — Weekly Monday 9am ET (13:00 UTC)
SELECT cron.schedule('warranty-reminders-weekly', '0 13 * * 1', $$
  SELECT extensions.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/warranty-reminder-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);

-- KPI Email — Weekly Monday 7am ET (11:00 UTC)
SELECT cron.schedule('kpi-email-weekly', '0 11 * * 1', $$
  SELECT extensions.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/kpi-email-sender',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);

-- NOTE: These are webhook/on-demand (no cron needed):
-- satisfaction-survey-sender, thank-you-sms-sender, ai-estimate-generator,
-- payment-chaser-sender, speed-lead-responder, review-alert-checker, ai-hiring-assistant
