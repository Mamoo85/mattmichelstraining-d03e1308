CREATE TABLE IF NOT EXISTS public.canonical_qa_quarantine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  product text NOT NULL,
  segment text,
  event_type text,
  event_category text,
  scope text,
  reasons text[] NOT NULL DEFAULT '{}',
  severity text NOT NULL DEFAULT 'warn' CHECK (severity IN ('warn','reject')),
  completeness numeric(5,2),
  candidate jsonb,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canonical_qa_quarantine_source_created
  ON public.canonical_qa_quarantine (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_canonical_qa_quarantine_product_created
  ON public.canonical_qa_quarantine (product, created_at DESC);

ALTER TABLE public.canonical_qa_quarantine ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role full access" ON public.canonical_qa_quarantine;
CREATE POLICY "service_role full access" ON public.canonical_qa_quarantine
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admins can read" ON public.canonical_qa_quarantine;
CREATE POLICY "admins can read" ON public.canonical_qa_quarantine
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));