
-- ============================================================================
-- SPRINT 1: ACTION LAYER FOUNDATION
-- Unified approval queue + spike tracking + displacement + apology log
-- ============================================================================

-- 1. UNIFIED OUTREACH APPROVAL QUEUE -----------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_function TEXT NOT NULL,                    -- e.g. 'techalert-auto-pitch'
  channel TEXT NOT NULL,                            -- 'email' | 'sms' | 'postcard' | 'fax' | 'linkedin'
  account_key TEXT,                                 -- mirror of intent_score_snapshots.account_key when applicable
  account_name TEXT,
  account_vertical TEXT,
  account_location TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_name TEXT,
  draft_subject TEXT,
  draft_body TEXT NOT NULL,
  signal_reason TEXT,                               -- "3 hiring signals + permit + traffic spike"
  signal_payload JSONB DEFAULT '{}'::jsonb,         -- structured proof (role list, competitor name, etc.)
  confidence_score NUMERIC(4,2),                    -- 0.00 - 1.00
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','sent','failed','expired')),
  idempotency_key TEXT UNIQUE,                      -- prevents duplicate drafts
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  sent_at TIMESTAMPTZ,
  send_result JSONB,
  rejected_reason TEXT,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oaq_status_created
  ON public.outreach_approval_queue(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oaq_account
  ON public.outreach_approval_queue(account_key) WHERE account_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oaq_pending
  ON public.outreach_approval_queue(created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_oaq_source
  ON public.outreach_approval_queue(source_function, status);

ALTER TABLE public.outreach_approval_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role full access" ON public.outreach_approval_queue;
CREATE POLICY "service_role full access" ON public.outreach_approval_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admins manage queue" ON public.outreach_approval_queue;
CREATE POLICY "admins manage queue" ON public.outreach_approval_queue
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.outreach_approval_queue;

-- 2. INTENT SPIKE ALERTS (de-dupes Matt's SMS) -------------------------------
CREATE TABLE IF NOT EXISTS public.intent_spike_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key TEXT NOT NULL,
  triggered_score NUMERIC NOT NULL,
  prior_score NUMERIC,
  week_start DATE NOT NULL,                         -- ISO week monday
  sms_sent_at TIMESTAMPTZ,
  sms_message_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_key, week_start)                  -- one alert per account per week
);

CREATE INDEX IF NOT EXISTS idx_intent_spike_week
  ON public.intent_spike_alerts(week_start DESC);

ALTER TABLE public.intent_spike_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role full access" ON public.intent_spike_alerts;
CREATE POLICY "service_role full access" ON public.intent_spike_alerts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admins read spike alerts" ON public.intent_spike_alerts;
CREATE POLICY "admins read spike alerts" ON public.intent_spike_alerts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. COMPETITOR MENTIONS (powers displacement detector) ----------------------
CREATE TABLE IF NOT EXISTS public.competitor_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_key TEXT,
  candidate_id UUID,
  source TEXT NOT NULL,                             -- 'job_description' | 'company_profile' | 'review'
  competitor_name TEXT NOT NULL,                    -- 'ServiceTitan', 'Jobber', etc.
  context_snippet TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acted_on BOOLEAN DEFAULT false,
  acted_at TIMESTAMPTZ,
  approval_queue_id UUID REFERENCES public.outreach_approval_queue(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_competitor_mentions_account
  ON public.competitor_mentions(account_key) WHERE account_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_competitor_mentions_unhandled
  ON public.competitor_mentions(detected_at DESC) WHERE acted_on = false;

ALTER TABLE public.competitor_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role full access" ON public.competitor_mentions;
CREATE POLICY "service_role full access" ON public.competitor_mentions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admins read mentions" ON public.competitor_mentions;
CREATE POLICY "admins read mentions" ON public.competitor_mentions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. APOLOGY RESEND LOG ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.m2_brief_apology_resend_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resend_message_id TEXT,
  status TEXT DEFAULT 'sent'
);

ALTER TABLE public.m2_brief_apology_resend_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role full access" ON public.m2_brief_apology_resend_log;
CREATE POLICY "service_role full access" ON public.m2_brief_apology_resend_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admins read apology log" ON public.m2_brief_apology_resend_log;
CREATE POLICY "admins read apology log" ON public.m2_brief_apology_resend_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. DAILY CRON: NURSYS AUTO-ENROLL (never lapse) ----------------------------
-- Already deployed function; just schedule it.
DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'nursys-enroll-batch-daily';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'nursys-enroll-batch-daily',
  '0 11 * * *',  -- 7am ET (11am UTC)
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/nursys-enroll-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJ.REDACTED.JWT'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 6. INTENT SPIKE NOTIFIER — every 4 hours -----------------------------------
DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'intent-spike-notifier-4h';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'intent-spike-notifier-4h',
  '15 */4 * * *',  -- every 4h at :15
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/intent-spike-notifier',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJ.REDACTED.JWT'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 7. WEEKLY DIGEST — Monday 7am ET (11am UTC) --------------------------------
DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'intent-weekly-digest-mon';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'intent-weekly-digest-mon',
  '0 11 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/intent-weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJ.REDACTED.JWT'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 8. TECHALERT AUTO-PITCH — every 6 hours ------------------------------------
DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'techalert-auto-pitch-6h';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'techalert-auto-pitch-6h',
  '30 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/techalert-auto-pitch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJ.REDACTED.JWT'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 9. COMPETITOR DISPLACEMENT DETECTOR — every 6 hours ------------------------
DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'competitor-displacement-6h';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'competitor-displacement-6h',
  '45 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/competitor-displacement-detector',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJ.REDACTED.JWT'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 10. APOLOGY RESEND — one-shot, fires tomorrow (2026-04-29) at 8am ET (12pm UTC)
-- Self-deletes after running.
DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'm2-brief-apology-resend-oneshot';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'm2-brief-apology-resend-oneshot',
  '0 12 29 4 *',  -- April 29 at noon UTC = 8am ET
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/m2-brief-apology-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJ.REDACTED.JWT'
    ),
    body := '{"trigger":"apology_resend_2026_04_29"}'::jsonb
  ) AS request_id;
  $$
);
