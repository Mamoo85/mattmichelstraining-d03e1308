-- ============================================================
-- AUTOMATED REVENUE CRON JOBS
-- Wires up all revenue-generating edge functions to run on
-- automatic schedules using pg_cron + pg_net.
-- All times are UTC. Eastern Time ≈ UTC-4 (EDT).
-- ============================================================

-- Ensure extensions are available
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;

-- Helper: unschedule a cron job if it already exists (idempotent re-runs)
DO $$
DECLARE job_names TEXT[] := ARRAY[
  'web-design-drip-daily',
  'trial-expiry-email-daily',
  'review-request-daily',
  'ai-bots-daily',
  'sports-newsletter-weekly',
  'auto-gbp-posts-weekly',
  'weekly-streak-check',
  'web-design-winback-monthly',
  'prospect-businesses-mon',
  'prospect-businesses-wed',
  'affiliate-commissions-6h',
  'churn-radar-daily'
];
job TEXT;
BEGIN
  FOREACH job IN ARRAY job_names LOOP
    BEGIN
      PERFORM cron.unschedule(job);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- LEAD GENERATION
-- prospect-local-businesses — Mon & Wed 9am ET (13:00 UTC)
-- Hunts new web design leads automatically twice a week.
-- Rotates through 3 contractor industries to keep leads fresh.
-- ============================================================

SELECT cron.schedule(
  'prospect-businesses-mon',
  '0 13 * * 1',
  $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/prospect-local-businesses',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key' LIMIT 1
      )
    ),
    body := '{"industry":"plumber","city":"Detroit MI","limit":10}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'prospect-businesses-wed',
  '0 13 * * 3',
  $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/prospect-local-businesses',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key' LIMIT 1
      )
    ),
    body := '{"industry":"electrician","city":"Detroit MI","limit":10}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================
-- WEB DESIGN DRIP SEQUENCE
-- web-design-drip — daily 10am ET (14:00 UTC)
-- Sends next email in 4-step sequence to all eligible leads.
-- Handles day 1, 4, 8, 15 timing automatically.
-- ============================================================

SELECT cron.schedule(
  'web-design-drip-daily',
  '0 14 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/web-design-drip',
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

-- ============================================================
-- WEB DESIGN WINBACK
-- web-design-winback — 1st of every month, 8am ET (12:00 UTC)
-- Re-engages leads that went cold 90+ days ago.
-- ============================================================

SELECT cron.schedule(
  'web-design-winback-monthly',
  '0 12 1 * *',
  $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/web-design-winback',
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

-- ============================================================
-- TRIAL CONVERSION
-- trial-day6-email — daily 7am ET (11:00 UTC)
-- Catches users whose 14-day trial expires tomorrow and sends
-- the upgrade nudge. Critical for paid conversion rate.
-- ============================================================

SELECT cron.schedule(
  'trial-expiry-email-daily',
  '0 11 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/trial-day6-email',
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

-- ============================================================
-- REVIEW REQUESTS
-- send-review-request — daily 11am ET (15:00 UTC)
-- Sends Google review request on day 30 of membership AND
-- when a user logs their first PR. Builds social proof.
-- ============================================================

SELECT cron.schedule(
  'review-request-daily',
  '0 15 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/send-review-request',
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

-- ============================================================
-- AI BOTS — WELCOME, UPSELL, WEEKLY RECAP
-- ai-automated-bots — daily 8am ET (12:00 UTC)
-- Sends welcome drip to new signups + upsell nudge to
-- engaged Basic users. Weekly recap fires on Sundays only
-- (the function's internal logic handles the day check).
-- ============================================================

SELECT cron.schedule(
  'ai-bots-daily',
  '0 12 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/ai-automated-bots',
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

-- ============================================================
-- WEEKLY NEWSLETTER
-- sports-newsletter-weekly — every Monday 6am ET (10:00 UTC)
-- Auto-generates and sends the M² Brief to all subscribers.
-- Builds authority + drives trial sign-ups.
-- ============================================================

SELECT cron.schedule(
  'sports-newsletter-weekly',
  '0 10 * * 1',
  $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/sports-newsletter-weekly',
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

-- ============================================================
-- GBP CONTENT GENERATION
-- auto-gbp-posts — every Monday 9am ET (13:00 UTC)
-- Generates weekly Google Business Profile post for each
-- active GBP management client and emails Matt to post it.
-- ============================================================

SELECT cron.schedule(
  'auto-gbp-posts-weekly',
  '0 13 * * 1',
  $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/auto-gbp-posts',
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

-- ============================================================
-- GAMIFICATION — STREAK CHECK
-- weekly-streak-check — every Monday 12:01am ET (04:01 UTC)
-- Runs at start of each week: awards streak points to users
-- who were active last week, resets streaks for those who weren't.
-- Higher engagement = lower churn.
-- ============================================================

SELECT cron.schedule(
  'weekly-streak-check',
  '1 4 * * 1',
  $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/weekly-streak-check',
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

-- ============================================================
-- AFFILIATE COMMISSIONS
-- calculate-affiliate-commissions — every 6 hours
-- Processes new referral conversions and creates commission
-- records so affiliates see their earnings same-day.
-- Fast processing motivates more referrals.
-- ============================================================

SELECT cron.schedule(
  'affiliate-commissions-6h',
  '0 */6 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/calculate-affiliate-commissions',
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

-- ============================================================
-- CHURN RADAR
-- churn-radar — daily midnight ET (04:00 UTC)
-- Flags paying users who went from 3+ sessions/week to zero.
-- Early warning = intervention before they cancel.
-- ============================================================

SELECT cron.schedule(
  'churn-radar-daily',
  '0 4 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/churn-radar',
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

-- ============================================================
-- VERIFY: query cron.job to confirm all jobs are registered
-- Run after applying: SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
-- ============================================================
