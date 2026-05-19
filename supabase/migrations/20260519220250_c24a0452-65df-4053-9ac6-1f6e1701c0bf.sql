
-- =====================================================================
-- 1. SNAPSHOT TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.cron_paused_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jobname text NOT NULL UNIQUE,
  schedule text NOT NULL,
  command text NOT NULL,
  product_slug text NOT NULL DEFAULT 'other',
  paused_at timestamptz NOT NULL DEFAULT now(),
  resumed_at timestamptz,
  resume_reason text
);

ALTER TABLE public.cron_paused_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_cron_paused_jobs"
  ON public.cron_paused_jobs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admin_read_cron_paused_jobs"
  ON public.cron_paused_jobs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_cron_paused_jobs_slug
  ON public.cron_paused_jobs (product_slug) WHERE resumed_at IS NULL;

-- =====================================================================
-- 2. PRODUCT-SLUG CLASSIFIER
-- =====================================================================
CREATE OR REPLACE FUNCTION public.classify_cron_product(_jobname text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _jobname ILIKE '%mortgage%radar%'        THEN 'mortgage_radar'
    WHEN _jobname ILIKE '%trade%radar%'           THEN 'trade_radar'
    WHEN _jobname ILIKE '%techalert%'
      OR _jobname ILIKE '%hire-alert%'
      OR _jobname ILIKE '%talent-radar%'          THEN 'techalert'
    WHEN _jobname ILIKE '%contractor%'            THEN 'contractor_leads'
    WHEN _jobname ILIKE '%field%service%'
      OR _jobname ILIKE '%field%desk%'
      OR _jobname ILIKE '%fielddesk%'             THEN 'fielddesk'
    WHEN _jobname ILIKE '%site%radar%'
      OR _jobname ILIKE '%visitor%'               THEN 'siteradar'
    WHEN _jobname ILIKE '%missed%call%'
      OR _jobname ILIKE '%callback%'
      OR _jobname ILIKE '%voicemail%'             THEN 'missed_call'
    WHEN _jobname ILIKE '%demand%radar%'
      OR _jobname ILIKE '%industry%pulse%contractor%' THEN 'demand_radar'
    WHEN _jobname ILIKE '%buyer%radar%'
      OR _jobname ILIKE '%industry%pulse%supplier%'   THEN 'buyer_radar'
    WHEN _jobname ILIKE '%dead%lead%'             THEN 'dead_lead'
    WHEN _jobname ILIKE '%marketplace%'           THEN 'marketplace'
    ELSE 'other'
  END
$$;

-- =====================================================================
-- 3. SNAPSHOT + UNSCHEDULE ALL NON-KEEPERS
-- =====================================================================
DO $$
DECLARE
  r record;
  keep_patterns text[] := ARRAY[
    -- Etsy/Printify (the only active customer-facing product)
    '%etsy%',
    '%printify%',
    '%pod%',
    -- Critical infrastructure (DO NOT pause — these keep spend & health in check)
    'api-spend-governor%',
    'cron-health-monitor%',
    'cron-zero-output-watchdog%',
    'edge-function-health-check%',
    'service-health-monitor%',
    'pipeline-health-monitor%',
    'enrichment-health-check%',
    'pulse-sms-health%',
    'outreach-backlog-watchdog%',
    'cleanup-%',
    'candidate-staleness-cleanup%',
    'code-fixer-watchdog%'
  ];
  keep boolean;
  p text;
BEGIN
  FOR r IN SELECT jobid, jobname, schedule, command FROM cron.job LOOP
    keep := false;
    FOREACH p IN ARRAY keep_patterns LOOP
      IF r.jobname ILIKE p THEN
        keep := true;
        EXIT;
      END IF;
    END LOOP;

    IF NOT keep THEN
      -- Snapshot (idempotent on jobname)
      INSERT INTO public.cron_paused_jobs (jobname, schedule, command, product_slug)
      VALUES (r.jobname, r.schedule, r.command, public.classify_cron_product(r.jobname))
      ON CONFLICT (jobname) DO UPDATE
        SET schedule = EXCLUDED.schedule,
            command  = EXCLUDED.command,
            product_slug = EXCLUDED.product_slug,
            paused_at = now(),
            resumed_at = NULL,
            resume_reason = NULL;

      -- Unschedule
      PERFORM cron.unschedule(r.jobid);
    END IF;
  END LOOP;
END $$;

-- =====================================================================
-- 4. RESUME HELPER — restores all paused jobs for a product slug
-- =====================================================================
CREATE OR REPLACE FUNCTION public.resume_product_crons(_slug text, _reason text DEFAULT 'auto-resume: first customer/trial')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  IF _slug IS NULL OR _slug = 'other' THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT jobname, schedule, command
    FROM public.cron_paused_jobs
    WHERE product_slug = _slug AND resumed_at IS NULL
  LOOP
    -- Re-schedule (cron.schedule replaces if jobname exists in newer pg_cron;
    -- guard with explicit unschedule attempt)
    BEGIN
      PERFORM cron.unschedule(r.jobname);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    PERFORM cron.schedule(r.jobname, r.schedule, r.command);

    UPDATE public.cron_paused_jobs
      SET resumed_at = now(), resume_reason = _reason
    WHERE jobname = r.jobname;

    n := n + 1;
  END LOOP;

  RETURN n;
END $$;

-- =====================================================================
-- 5. AUTO-RESUME TRIGGERS — fire on first INSERT into each product's client/trial table
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trg_resume_crons_for_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  slug text := TG_ARGV[0];
BEGIN
  PERFORM public.resume_product_crons(slug);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the insert
  RETURN NEW;
END $$;

-- Helper to (re)create a trigger only if the target table exists
DO $$
DECLARE
  pairs text[][] := ARRAY[
    ARRAY['mortgage_radar_clients',  'mortgage_radar'],
    ARRAY['trade_radar_clients',     'trade_radar'],
    ARRAY['hire_alert_clients',      'techalert'],
    ARRAY['contractor_clients',      'contractor_leads'],
    ARRAY['field_crm_clients',       'fielddesk'],
    ARRAY['missed_call_clients',     'missed_call'],
    ARRAY['industry_pulse_clients',  'demand_radar'],
    ARRAY['dead_lead_campaigns',     'dead_lead'],
    ARRAY['marketplace_lead_locks',  'marketplace'],
    ARRAY['radar_trials',            'mortgage_radar'],   -- trials count too
    ARRAY['trial_signups',           'mortgage_radar']
  ];
  pair text[];
  trig_name text;
BEGIN
  FOREACH pair SLICE 1 IN ARRAY pairs LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=pair[1]
    ) THEN
      trig_name := 'trg_resume_crons_' || pair[1];
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trig_name, pair[1]);
      EXECUTE format(
        'CREATE TRIGGER %I AFTER INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trg_resume_crons_for_product(%L)',
        trig_name, pair[1], pair[2]
      );
    END IF;
  END LOOP;
END $$;
