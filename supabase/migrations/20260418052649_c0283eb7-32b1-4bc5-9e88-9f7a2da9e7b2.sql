-- ===== LARA Health Log (was queried by AdminLaraHealth but never existed) =====
CREATE TABLE IF NOT EXISTS public.lara_health_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status text NOT NULL,
  http_status integer,
  response_bytes integer,
  response_time_ms integer,
  error_message text,
  fallback_activated boolean DEFAULT false,
  fallback_sources text[],
  candidates_from_fallback integer DEFAULT 0,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lara_health_log_checked_at ON public.lara_health_log(checked_at DESC);

ALTER TABLE public.lara_health_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role bypass" ON public.lara_health_log;
CREATE POLICY "service_role bypass" ON public.lara_health_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admins can read lara_health_log" ON public.lara_health_log;
CREATE POLICY "admins can read lara_health_log" ON public.lara_health_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ===== LARA VAL Cursor (single row, tracks sequential probe progress) =====
CREATE TABLE IF NOT EXISTS public.lara_val_cursor (
  id integer PRIMARY KEY,
  last_val_id bigint NOT NULL DEFAULT 6500000,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.lara_val_cursor (id, last_val_id) VALUES (1, 6500000)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.lara_val_cursor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role bypass" ON public.lara_val_cursor;
CREATE POLICY "service_role bypass" ON public.lara_val_cursor
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===== Promote scanner cron from daily to every 4 hours =====
DO $$
DECLARE
  job_id_to_unschedule int;
  url text;
  service_key text;
BEGIN
  -- Unschedule any existing daily/4h scanner jobs
  FOR job_id_to_unschedule IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('hire-alert-scanner-daily','hire-alert-scanner-4h','hire-alert-scanner-hourly')
  LOOP
    PERFORM cron.unschedule(job_id_to_unschedule);
  END LOOP;

  -- Pull URL + key from vault (approved hardcoded-URL pattern allowed if vault not present)
  BEGIN
    SELECT decrypted_secret INTO url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL_VAULT';
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT';
  EXCEPTION WHEN OTHERS THEN
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co';
    service_key := NULL;
  END;

  IF url IS NULL THEN
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  END IF;

  -- Schedule scanner every 4 hours
  PERFORM cron.schedule(
    'hire-alert-scanner-4h',
    '0 */4 * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      )
    $job$,
    url || '/functions/v1/hire-alert-scanner',
    CASE WHEN service_key IS NOT NULL
      THEN jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key)::text
      ELSE jsonb_build_object('Content-Type','application/json')::text
    END
    )
  );
END $$;

-- ===== Auto-enrichment trigger: instantly enrich every new person candidate =====
CREATE OR REPLACE FUNCTION public.trigger_enrich_new_candidate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  url text;
  service_key text;
BEGIN
  -- Skip business-directory candidates and company-name candidates
  IF NEW.is_company_name = true THEN RETURN NEW; END IF;
  IF NEW.source IN ('yelp','phcc','building_permits','thumbtack','google_places','yelp_business') THEN RETURN NEW; END IF;

  -- Get URL + key from vault, fall back to hardcoded
  BEGIN
    SELECT decrypted_secret INTO url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL_VAULT';
    SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT';
  EXCEPTION WHEN OTHERS THEN
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  END;
  IF url IS NULL THEN url := 'https://eauvubfpanpeuxsrqesu.supabase.co'; END IF;

  -- Fire-and-forget: invoke deep-enrich for this single candidate
  PERFORM net.http_post(
    url := url || '/functions/v1/candidate-deep-enrich?ids=' || NEW.id::text || '&force=1',
    headers := CASE WHEN service_key IS NOT NULL
      THEN jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key)
      ELSE jsonb_build_object('Content-Type','application/json')
    END,
    body := '{}'::jsonb
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the insert
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_enrich_new_candidate ON public.hire_alert_candidates;
CREATE TRIGGER auto_enrich_new_candidate
  AFTER INSERT ON public.hire_alert_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_enrich_new_candidate();