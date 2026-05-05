
-- ============================================================
-- 1. Drop redundant tables from prior bad plan
-- ============================================================
DROP TABLE IF EXISTS public.trial_concierge_log CASCADE;
DROP TABLE IF EXISTS public.trial_delivery_sla CASCADE;

-- ============================================================
-- 2. Extend trial_signups with delivery tracking columns
-- ============================================================
ALTER TABLE public.trial_signups
  ADD COLUMN IF NOT EXISTS first_lead_delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lead_count_d1 INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_count_d2 INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_count_d3 INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_count_d4 INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_count_d5 INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_count_d6 INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_count_d7 INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sla_status TEXT NOT NULL DEFAULT 'green',
  ADD COLUMN IF NOT EXISTS compensation_applied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS compensation_amount_cents INT,
  ADD COLUMN IF NOT EXISTS last_concierge_touch_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_trial_signups_sla_status ON public.trial_signups(sla_status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_trial_signups_email_product ON public.trial_signups(email, product_key) WHERE status = 'active';

-- ============================================================
-- 3. Trigger function: increment correct day counter on lead insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.bump_trial_lead_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email TEXT;
  v_product_filter TEXT;
  v_trial RECORD;
  v_day INT;
  v_col TEXT;
BEGIN
  -- Determine email + which product_key prefix to match based on table
  IF TG_TABLE_NAME = 'trade_radar_leads' THEN
    SELECT email INTO v_email FROM public.trade_radar_clients WHERE id = NEW.client_id;
    v_product_filter := 'trade_radar%';
  ELSIF TG_TABLE_NAME = 'mortgage_radar_leads' THEN
    -- mortgage_radar_leads.client_id may be NULL (area signal) — try via matched client
    SELECT email INTO v_email FROM public.mortgage_radar_clients WHERE id = NEW.client_id;
    v_product_filter := 'mortgage_radar%';
  ELSE
    RETURN NEW;
  END IF;

  IF v_email IS NULL THEN RETURN NEW; END IF;

  -- Find active trial for this email + product family
  SELECT id, trial_started_at, first_lead_delivered_at
    INTO v_trial
    FROM public.trial_signups
   WHERE LOWER(email) = LOWER(v_email)
     AND status = 'active'
     AND product_key LIKE v_product_filter
   ORDER BY trial_started_at DESC
   LIMIT 1;

  IF v_trial.id IS NULL THEN RETURN NEW; END IF;

  -- Days elapsed (1-indexed: first 24h = day 1)
  v_day := LEAST(7, GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (NOW() - v_trial.trial_started_at)) / 86400)::int + 1));
  v_col := 'lead_count_d' || v_day;

  EXECUTE format(
    'UPDATE public.trial_signups SET %I = %I + 1, first_lead_delivered_at = COALESCE(first_lead_delivered_at, NOW()) WHERE id = $1',
    v_col, v_col
  ) USING v_trial.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block lead insert
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_trial_lead_count_trade ON public.trade_radar_leads;
CREATE TRIGGER trg_bump_trial_lead_count_trade
  AFTER INSERT ON public.trade_radar_leads
  FOR EACH ROW EXECUTE FUNCTION public.bump_trial_lead_count();

DROP TRIGGER IF EXISTS trg_bump_trial_lead_count_mortgage ON public.mortgage_radar_leads;
CREATE TRIGGER trg_bump_trial_lead_count_mortgage
  AFTER INSERT ON public.mortgage_radar_leads
  FOR EACH ROW EXECUTE FUNCTION public.bump_trial_lead_count();

-- ============================================================
-- 4. Cron: trial-drip-runner daily at 15:00 UTC (11am ET)
-- ============================================================
DO $$
BEGIN
  PERFORM cron.unschedule('trial-drip-runner-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('trial-sla-watchdog-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'trial-drip-runner-daily',
  '0 15 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/trial-drip-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
