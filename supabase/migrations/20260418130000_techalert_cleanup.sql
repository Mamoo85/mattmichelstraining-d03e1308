-- Backfill is_company_name on obvious garbage rows, then change scanner cron to every 4h

-- 1. Mark known garbage rows as company names so they're excluded from alerts/dashboards
UPDATE public.hire_alert_candidates
SET is_company_name = true
WHERE is_company_name IS NOT TRUE
  AND (
    -- Known garbage by name pattern
    lower(full_name) IN (
      'mr pipey', 'rocket pros', 'comfort zone and', 'marvin and son',
      'a1 bargain', 'drewski handyman', 'plumb pros', 'comfort zone',
      'a1 bargain handyman', 'all pro', 'all pros'
    )
    -- Phone number as name
    OR full_name ~ '^\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]?\d{4}$'
    -- ALL CAPS names longer than 8 chars (company flag)
    OR (full_name = upper(full_name) AND length(full_name) > 8 AND full_name ~ '[A-Z]{4,}')
    -- Ends in trade/company words
    OR lower(full_name) ~ '\y(llc|inc|corp|co|pros|pro|services|service|handyman|plumbing|electric|hvac|heating|cooling|mechanical|contractors|solutions|repair|zone|bargain)\y'
    -- Contains ampersand (company name pattern)
    OR full_name LIKE '%&%'
    -- Fewer than 2 real alpha words (not a person name)
    OR array_length(
      array(
        SELECT w FROM unnest(string_to_array(trim(full_name), ' ')) w
        WHERE w ~ '^[a-zA-Z][a-zA-Z\-'']{1,}$' AND length(w) >= 2
      ), 1
    ) < 2
  );

-- 2. Change hire-alert-scanner from daily (7am ET) to every 4 hours
SELECT cron.unschedule('hire-alert-scanner-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hire-alert-scanner-daily');

SELECT cron.schedule(
  'hire-alert-scanner-4h',
  '0 */4 * * *',
  $$
  SELECT extensions.http_post(
    url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/hire-alert-scanner',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1)
    ),
    body:='{}'::jsonb
  )
  $$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hire-alert-scanner-4h');
