CREATE TABLE IF NOT EXISTS public.tenant_intel_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  searched_by text DEFAULT 'anonymous',
  query_name text NOT NULL,
  query_city text,
  query_state text DEFAULT 'MI',
  query_dob text,
  result_summary jsonb DEFAULT '{}',
  full_results jsonb DEFAULT '{}',
  sources_hit int DEFAULT 0,
  sources_returned int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_intel_searches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_bypass" ON public.tenant_intel_searches
    TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_intel_created ON public.tenant_intel_searches (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_intel_name ON public.tenant_intel_searches (query_name);