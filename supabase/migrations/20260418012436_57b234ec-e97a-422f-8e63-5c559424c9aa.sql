-- =====================================================
-- Phase 17 FIX: Rebuild 21 dormant crons with PROVEN anon-key pattern
-- =====================================================
-- The vault has only `email_queue_service_role_key` (no SUPABASE_URL,
-- no SUPABASE_SERVICE_ROLE_KEY). Every prior vault-lookup migration
-- silently scheduled NULL-URL crons. This migration uses the same
-- hardcoded URL + inlined anon JWT that 80+ working crons already use.

DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhdXZ1YmZwYW5wZXV4c3JxZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MzI3MDYsImV4cCI6MjA4OTIwODcwNn0.QF4PaTIhhwBkl0hgh68W4R2CxH22ReokGwJUebI2tKw';
  v_hdr text;
  v_jobs text[] := ARRAY[
    'abandoned-cart-weekly','annual-review-yearly','boiler-sector-intel-daily',
    'client-report-monthly','competitor-monitor-scan-weekly','demand-radar-digest-daily',
    'endpoint-drift-detector-weekly','hire-alert-phantom-alert-daily','hire-alert-scanner-daily',
    'industrial-growth-intel-daily','insurance-drip-weekly','invoice-chaser-daily',
    'linkedin-outreach-weekly','monthly-proof-email','new-mover-weekly',
    'pipeline-health-monitor-morning','podcast-pitch-monthly','restaurant-menu-monthly',
    'service-health-monitor-30min','techalert-weekly-digest-monday','weekly-sms-blast-tuesday'
  ];
  v_schedules text[] := ARRAY[
    '0 13 * * 2','0 14 5 1 *','0 11 * * *','0 14 1 * *','0 6 * * 1','0 11 * * *',
    '0 7 * * 0','30 12 * * *','0 11 * * *','0 12 * * *','0 14 * * 3','0 14 * * *',
    '0 14 * * 4','0 13 1 * *','0 14 * * 2','0 11 * * *','0 14 1 * *','0 15 1 * *',
    '*/30 * * * *','0 13 * * 1','0 14 * * 2'
  ];
  v_endpoints text[] := ARRAY[
    'abandoned-cart-sender','annual-review-sender','boiler-sector-intel',
    'client-report-sender','competitor-monitor-scan','demand-radar-digest',
    'endpoint-drift-detector','hire-alert-phantom-alert','hire-alert-scanner',
    'industrial-growth-intel','insurance-drip-sender','invoice-chaser-runner',
    'linkedin-outreach-sender','monthly-proof-email','new-mover-sender',
    'pipeline-health-monitor','podcast-pitch-sender','restaurant-menu-sender',
    'service-health-monitor','techalert-weekly-digest','weekly-sms-sender'
  ];
  i int;
BEGIN
  -- 🛡️ NULL GUARDS — fail loud, never silent. This is the discipline.
  IF v_url IS NULL OR v_url = '' THEN
    RAISE EXCEPTION 'v_url is empty — refusing to schedule broken crons';
  END IF;
  IF v_key IS NULL OR v_key = '' OR LENGTH(v_key) < 100 THEN
    RAISE EXCEPTION 'v_key is empty or too short — refusing to schedule broken crons';
  END IF;
  IF array_length(v_jobs, 1) <> array_length(v_schedules, 1)
     OR array_length(v_jobs, 1) <> array_length(v_endpoints, 1) THEN
    RAISE EXCEPTION 'Job/schedule/endpoint arrays misaligned';
  END IF;

  v_hdr := json_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_key
  )::text;

  FOR i IN 1 .. array_length(v_jobs, 1) LOOP
    PERFORM cron.unschedule(v_jobs[i])
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_jobs[i]);

    PERFORM cron.schedule(
      v_jobs[i],
      v_schedules[i],
      format(
        $job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
        v_url || '/functions/v1/' || v_endpoints[i],
        v_hdr
      )
    );
  END LOOP;

  RAISE NOTICE '✅ Rebuilt % cron jobs with hardcoded URL + anon JWT pattern.', array_length(v_jobs, 1);

  -- 🚀 Fire 3 critical scanners RIGHT NOW so user sees data within minutes
  PERFORM net.http_post(
    url := v_url || '/functions/v1/hire-alert-scanner',
    headers := v_hdr::jsonb,
    body := '{}'::jsonb
  );
  PERFORM net.http_post(
    url := v_url || '/functions/v1/pipeline-health-monitor',
    headers := v_hdr::jsonb,
    body := '{}'::jsonb
  );
  PERFORM net.http_post(
    url := v_url || '/functions/v1/service-health-monitor',
    headers := v_hdr::jsonb,
    body := '{}'::jsonb
  );

  RAISE NOTICE '🚀 Manually fired 3 critical scanners. Data should land in 60-90 seconds.';
END $migration$;