-- Meta Ads Copy Generator — Monday 7am ET (11:00 UTC)
SELECT cron.schedule('meta-ads-copy-weekly', '0 11 * * 1', $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/meta-ads-copy-generator',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);

-- SEO Blog Publisher — 15th of each month at 9am ET (13:00 UTC)
SELECT cron.schedule('seo-blog-monthly', '0 13 15 * *', $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/seo-blog-publisher',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)),
    body := '{}'::jsonb) AS request_id; $$);
