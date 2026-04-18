-- Rebuild 20 silently-failing crons using the proven inline vault pattern
-- Same approach as 20260413000000_fix_broken_crons.sql which fixed 19 crons successfully

DO $$
DECLARE
  jobs text[] := ARRAY[
    'abandoned-cart-weekly','annual-review-yearly','boiler-sector-intel-daily',
    'client-report-monthly','competitor-monitor-scan-weekly','demand-radar-digest-daily',
    'endpoint-drift-detector-weekly','hire-alert-phantom-alert-daily','hire-alert-scanner-daily',
    'industrial-growth-intel-daily','insurance-drip-weekly','invoice-chaser-daily',
    'linkedin-outreach-weekly','monthly-proof-email','new-mover-weekly',
    'pipeline-health-monitor-morning','podcast-pitch-monthly','restaurant-menu-monthly',
    'techalert-weekly-digest-monday','weekly-sms-blast-tuesday'
  ];
  j text;
BEGIN
  FOREACH j IN ARRAY jobs LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = j) THEN
      PERFORM cron.unschedule(j);
    END IF;
  END LOOP;
END $$;

SELECT cron.schedule('abandoned-cart-weekly','0 13 * * 2',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/abandoned-cart-sender', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('annual-review-yearly','0 14 5 1 *',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/annual-review-sender', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('boiler-sector-intel-daily','0 11 * * *',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/boiler-sector-intel', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('client-report-monthly','0 14 1 * *',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/client-report-sender', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('competitor-monitor-scan-weekly','0 6 * * 1',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/competitor-monitor-scan', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('demand-radar-digest-daily','0 11 * * *',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/demand-radar-digest', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('endpoint-drift-detector-weekly','0 7 * * 0',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/endpoint-drift-detector', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('hire-alert-phantom-alert-daily','30 12 * * *',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/hire-alert-phantom-alert', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('hire-alert-scanner-daily','0 11 * * *',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/hire-alert-scanner', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('industrial-growth-intel-daily','0 12 * * *',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/industrial-growth-intel', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('insurance-drip-weekly','0 14 * * 3',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/insurance-drip-sender', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('invoice-chaser-daily','0 14 * * *',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/invoice-chaser-runner', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('linkedin-outreach-weekly','0 14 * * 4',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/linkedin-outreach-sender', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('monthly-proof-email','0 13 1 * *',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/monthly-proof-email', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('new-mover-weekly','0 14 * * 2',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/new-mover-sender', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('pipeline-health-monitor-morning','0 11 * * *',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/pipeline-health-monitor', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('podcast-pitch-monthly','0 14 1 * *',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/podcast-pitch-sender', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('restaurant-menu-monthly','0 15 1 * *',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/restaurant-menu-sender', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('techalert-weekly-digest-monday','0 13 * * 1',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/techalert-weekly-digest', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);

SELECT cron.schedule('weekly-sms-blast-tuesday','0 14 * * 2',$$SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/weekly-sms-sender', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')), body := '{"source":"cron"}'::jsonb)$$);