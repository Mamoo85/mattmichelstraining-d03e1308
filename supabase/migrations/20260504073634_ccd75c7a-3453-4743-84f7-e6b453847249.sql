-- Ingestion DLQ
CREATE TABLE IF NOT EXISTS public.ingestion_dlq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 5,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  last_attempt_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ingestion_dlq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_ingestion_dlq" ON public.ingestion_dlq FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "admins_read_ingestion_dlq" ON public.ingestion_dlq FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_ingestion_dlq_due
  ON public.ingestion_dlq(next_retry_at) WHERE status IN ('pending','retrying');
CREATE INDEX IF NOT EXISTS idx_ingestion_dlq_job ON public.ingestion_dlq(job_name, created_at DESC);

-- Registry QA snapshots
CREATE TABLE IF NOT EXISTS public.registry_qa_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  waterfall text NOT NULL,
  signal_count integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, waterfall)
);
ALTER TABLE public.registry_qa_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_registry_qa" ON public.registry_qa_snapshots FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "admins_read_registry_qa" ON public.registry_qa_snapshots FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_registry_qa_date ON public.registry_qa_snapshots(snapshot_date DESC);

-- Trial attribution
CREATE TABLE IF NOT EXISTS public.trial_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  product text NOT NULL,
  source text,
  campaign text,
  utm_medium text,
  utm_content text,
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  trial_converted_at timestamptz,
  sub_converted_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE public.trial_attribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_trial_attribution" ON public.trial_attribution FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "admins_read_trial_attribution" ON public.trial_attribution FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_trial_attribution_email ON public.trial_attribution(lower(email));
CREATE INDEX IF NOT EXISTS idx_trial_attribution_product ON public.trial_attribution(product, trial_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_attribution_source ON public.trial_attribution(source, trial_started_at DESC);

-- Provenance + confidence on radar lead tables
ALTER TABLE public.trade_radar_leads
  ADD COLUMN IF NOT EXISTS provenance jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS confidence_score integer,
  ADD COLUMN IF NOT EXISTS dedupe_key text;
CREATE INDEX IF NOT EXISTS idx_trade_radar_leads_dedupe ON public.trade_radar_leads(dedupe_key) WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.mortgage_radar_leads
  ADD COLUMN IF NOT EXISTS provenance jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS confidence_score integer,
  ADD COLUMN IF NOT EXISTS dedupe_key text;
CREATE INDEX IF NOT EXISTS idx_mortgage_radar_leads_dedupe ON public.mortgage_radar_leads(dedupe_key) WHERE dedupe_key IS NOT NULL;