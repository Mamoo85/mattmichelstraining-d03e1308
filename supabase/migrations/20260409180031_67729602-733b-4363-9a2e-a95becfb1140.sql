
-- Create all cron jobs with correct project URL (eauvubfpanpeuxsrqesu)
-- Using DO block to safely unschedule if they already exist
DO $$ BEGIN PERFORM cron.unschedule('linkedin-outreach-weekly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('abandoned-cart-weekly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('client-report-monthly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('restaurant-menu-monthly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('insurance-drip-weekly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('podcast-pitch-monthly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('testimonial-harvester-weekly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('new-mover-weekly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('annual-review-yearly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('review-monitor-6h'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('weekly-sms-blast-tuesday'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('noshow-followup-5min'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('estimate-drip-hourly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('invoice-chaser-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('afterjob-drip-hourly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('sms-product-monitor-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('linkedin-outreach-weekly','0 12 * * 1',$$SELECT extensions.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/linkedin-outreach-sender',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb)$$);

SELECT cron.schedule('abandoned-cart-weekly','0 13 * * 2',$$SELECT extensions.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/abandoned-cart-sender',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb)$$);

SELECT cron.schedule('client-report-monthly','0 14 1 * *',$$SELECT extensions.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/client-report-sender',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb)$$);

SELECT cron.schedule('restaurant-menu-monthly','0 14 15 * *',$$SELECT extensions.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/restaurant-menu-sender',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb)$$);

SELECT cron.schedule('insurance-drip-weekly','0 14 * * 3',$$SELECT extensions.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/insurance-drip-sender',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb)$$);

SELECT cron.schedule('podcast-pitch-monthly','0 14 10 * *',$$SELECT extensions.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/podcast-pitch-sender',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb)$$);

SELECT cron.schedule('testimonial-harvester-weekly','0 13 * * 4',$$SELECT extensions.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/testimonial-harvester-sender',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb)$$);

SELECT cron.schedule('new-mover-weekly','0 14 * * 5',$$SELECT extensions.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/new-mover-sender',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb)$$);

SELECT cron.schedule('annual-review-yearly','0 14 5 1 *',$$SELECT extensions.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/annual-review-sender',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb)$$);

SELECT cron.schedule('review-monitor-6h','0 4,10,16,22 * * *',$$SELECT extensions.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/review-monitor',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb)$$);

SELECT cron.schedule('weekly-sms-blast-tuesday','0 12 * * 2',$$SELECT extensions.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/weekly-sms-sender',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb)$$);

SELECT cron.schedule('noshow-followup-5min','*/5 * * * *',$$SELECT extensions.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/noshow-followup',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb)$$);

SELECT cron.schedule('estimate-drip-hourly','0 * * * *',$$SELECT extensions.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/estimate-drip-runner',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb)$$);

SELECT cron.schedule('invoice-chaser-daily','0 13 * * *',$$SELECT extensions.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/invoice-chaser-runner',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb)$$);

SELECT cron.schedule('afterjob-drip-hourly','0 * * * *',$$SELECT extensions.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/afterjob-drip-runner',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb)$$);

SELECT cron.schedule('sms-product-monitor-daily','0 11 * * *',$$SELECT extensions.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/sms-product-monitor',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),body:='{}'::jsonb)$$);
