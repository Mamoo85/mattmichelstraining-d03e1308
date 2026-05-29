-- ─────────────────────────────────────────────────────────────────────────────
-- CRON SCHEDULES — 10 New SMS/Monitoring Products + Oracle Watchdog
-- All times ET. ET = UTC-4 (summer) / UTC-5 (winter). Using UTC-4 (EST DST).
-- ─────────────────────────────────────────────────────────────────────────────

-- Review Monitor — every 6 hours (midnight, 6am, noon, 6pm ET)
SELECT cron.schedule('review-monitor-6h','0 4,10,16,22 * * *',$$SELECT extensions.http_post(url:='https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/review-monitor',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb) AS request_id;$$);

-- Weekly SMS Blast — every Tuesday 8am ET (12:00 UTC)
SELECT cron.schedule('weekly-sms-blast-tuesday','0 12 * * 2',$$SELECT extensions.http_post(url:='https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/weekly-sms-sender',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb) AS request_id;$$);

-- No-Show Followup — every 5 minutes (sends pending re-booking texts)
SELECT cron.schedule('noshow-followup-5min','*/5 * * * *',$$SELECT extensions.http_post(url:='https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/noshow-followup',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb) AS request_id;$$);

-- Estimate Drip Runner — hourly (sends pending estimate sequence steps)
SELECT cron.schedule('estimate-drip-hourly','0 * * * *',$$SELECT extensions.http_post(url:='https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/estimate-drip-runner',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb) AS request_id;$$);

-- Invoice Chaser Runner — daily 9am ET (13:00 UTC)
SELECT cron.schedule('invoice-chaser-daily','0 13 * * *',$$SELECT extensions.http_post(url:='https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/invoice-chaser-runner',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb) AS request_id;$$);

-- After-Job Drip Runner — hourly (sends pending after-job sequence steps)
SELECT cron.schedule('afterjob-drip-hourly','0 * * * *',$$SELECT extensions.http_post(url:='https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/afterjob-drip-runner',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb) AS request_id;$$);

-- SMS Product Monitor (Oracle Watchdog) — daily 7am ET (11:00 UTC)
-- Texts Matt at (313) 806-4952 if any accounts are unconfigured/stuck/silent
SELECT cron.schedule('sms-product-monitor-daily','0 11 * * *',$$SELECT extensions.http_post(url:='https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/sms-product-monitor',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb) AS request_id;$$);
