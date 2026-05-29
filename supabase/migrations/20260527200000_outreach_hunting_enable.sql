-- Phase 94: Re-enable DWA cold-outreach HUNTING ONLY (Step 1 of staged re-enable)
-- Throttles to 1x/day to allow controlled verification before ramp-up.
-- Does NOT enable sending (techalert-outreach / dwa-product-blast).
-- IMPORTANT: API keys (GOOGLE_MAPS_API_KEY, OPENROUTER_API_KEY) must be set in
-- Supabase PRIMARY secrets dashboard before these crons produce rows.
--
-- Verify after first run:
--   SELECT COUNT(*), MAX(created_at) FROM techalert_prospect_targets;
--   SELECT COUNT(*), MAX(created_at) FROM outreach_leads WHERE stage='0_New_Extracted_Lead';
--   SELECT service, cents_used FROM api_usage_daily WHERE usage_date = CURRENT_DATE;

-- 1. Unschedule all existing hunter variants and reschedule to 1x/day
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'techalert-prospect-hunter-daily',
  'techalert-prospect-hunter-3x',
  'techalert-prospect-hunter-2x'
);

SELECT cron.schedule(
  'techalert-prospect-hunter-daily',
  '0 10 * * *',
  $$SELECT net.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/techalert-prospect-hunter',headers:='{"Content-Type":"application/json"}'::jsonb,body:='{"trigger":"cron"}'::jsonb)$$
);

-- 2. Unschedule all existing replenisher variants and reschedule to 1x/day
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'outreach-prospect-replenisher-daily',
  'outreach-prospect-replenisher-2x',
  'outreach-prospect-replenisher-3x'
);

SELECT cron.schedule(
  'outreach-prospect-replenisher-daily',
  '0 13 * * *',
  $$SELECT net.http_post(url:='https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/outreach-prospect-replenisher',headers:='{"Content-Type":"application/json"}'::jsonb,body:='{}'::jsonb)$$
);

-- 3. Reset cold_email_ramp_state to unpaused with conservative 25/day cap
-- (state may have been paused when APIs were disabled)
INSERT INTO public.cold_email_ramp_state (id, paused, current_cap, base_cap, ramp_start_date)
VALUES (1, false, 25, 25, CURRENT_DATE)
ON CONFLICT (id) DO UPDATE
  SET paused = false,
      current_cap = 25,
      base_cap = 25,
      ramp_start_date = CURRENT_DATE,
      pause_reason = NULL,
      updated_at = now();
