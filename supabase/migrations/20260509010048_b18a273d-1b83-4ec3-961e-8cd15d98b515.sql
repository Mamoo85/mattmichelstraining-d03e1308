
ALTER TABLE public.hire_alert_candidates
  ADD COLUMN IF NOT EXISTS fingerprint text,
  ADD COLUMN IF NOT EXISTS sources text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_source text,
  ADD COLUMN IF NOT EXISTS provenance jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS name_normalized text,
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS email_normalized text,
  ADD COLUMN IF NOT EXISTS domain_normalized text,
  ADD COLUMN IF NOT EXISTS ingest_confidence numeric(3,2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_hire_REDACTED
  ON public.hire_alert_candidates (fingerprint) WHERE fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hire_REDACTED
  ON public.hire_alert_candidates (trade, state, name_normalized);
CREATE INDEX IF NOT EXISTS idx_hire_REDACTED
  ON public.hire_alert_candidates (license_number, license_type) WHERE license_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hire_REDACTED
  ON public.hire_alert_candidates USING gin (sources);

ALTER TABLE public.hire_alert_runs
  ADD COLUMN IF NOT EXISTS merged integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS errors_detail jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS replay_url text,
  ADD COLUMN IF NOT EXISTS source_label text;

CREATE TABLE IF NOT EXISTS public.talent_ingest_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_record_id text,
  run_id uuid REFERENCES public.hire_alert_runs(id),
  payload jsonb NOT NULL DEFAULT '{}',
  fingerprint text,
  dedupe_outcome text CHECK (dedupe_outcome IN ('new','merged','dup','rejected','error')),
  candidate_id uuid REFERENCES public.hire_alert_candidates(id),
  rejection_reason text,
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.talent_ingest_raw ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='talent_ingest_raw' AND policyname='service_role_all_talent_ingest_raw') THEN
    CREATE POLICY "service_role_all_talent_ingest_raw" ON public.talent_ingest_raw
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='talent_ingest_raw' AND policyname='admin_read_talent_ingest_raw') THEN
    CREATE POLICY "admin_read_talent_ingest_raw" ON public.talent_ingest_raw
      FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_talent_ingest_raw_source ON public.talent_ingest_raw (source, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_talent_ingest_raw_fingerprint ON public.talent_ingest_raw (fingerprint) WHERE fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_talent_ingest_raw_run ON public.talent_ingest_raw (run_id);

-- Backfill normalization
UPDATE public.hire_alert_candidates SET
  name_normalized = lower(regexp_replace(trim(coalesce(full_name, name, '')), '\s+', ' ', 'g')),
  email_normalized = lower(trim(email)),
  phone_e164 = CASE
    WHEN phone ~ '^\+1[0-9]{10}$' THEN phone
    WHEN regexp_replace(coalesce(phone,''), '\D', '', 'g') ~ '^[0-9]{10}$'
      THEN '+1' || regexp_replace(phone, '\D', '', 'g')
    ELSE NULL
  END
WHERE name_normalized IS NULL;

-- Collapse exact license_number duplicates (keep oldest by created_at)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT license_number, license_type,
           (array_agg(id ORDER BY created_at NULLS LAST))[1] AS keep_id,
           array_agg(id) AS all_ids,
           array_agg(DISTINCT source) FILTER (WHERE source IS NOT NULL) AS all_sources
    FROM public.hire_alert_candidates
    WHERE license_number IS NOT NULL AND fingerprint IS NULL
    GROUP BY license_number, license_type
    HAVING count(*) > 1
  LOOP
    UPDATE public.hire_alert_candidates
      SET sources = COALESCE(sources, '{}') || COALESCE(r.all_sources, '{}')
      WHERE id = r.keep_id;

    DELETE FROM public.hire_alert_candidates
      WHERE id = ANY(r.all_ids) AND id <> r.keep_id;
  END LOOP;
END $$;

-- Crons
DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text := 'eyJ.REDACTED.JWT';
BEGIN
  IF v_url IS NULL OR v_url = '' THEN RAISE EXCEPTION 'v_url empty'; END IF;
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'v_key invalid'; END IF;

  PERFORM cron.unschedule('talent-ingest-raw-purge')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'talent-ingest-raw-purge');
  PERFORM cron.schedule(
    'talent-ingest-raw-purge',
    '0 3 * * *',
    $$DELETE FROM public.talent_ingest_raw WHERE received_at < now() - interval '30 days'$$
  );

  PERFORM cron.unschedule('talent-ingest-multisource-digest')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'talent-ingest-multisource-digest');
  PERFORM cron.schedule(
    'talent-ingest-multisource-digest',
    '0 13 * * 1',
    format(
      $job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{"kind":"multisource_weekly"}'::jsonb);$job$,
      v_url || '/functions/v1/talent-ingest-digest',
      json_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key)::text
    )
  );
END $migration$;
