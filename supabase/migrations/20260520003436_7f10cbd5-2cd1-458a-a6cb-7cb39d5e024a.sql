
CREATE TABLE IF NOT EXISTS public.pod_dimension_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.pod_listings(id) ON DELETE CASCADE,
  printify_id text NOT NULL,
  product_type text NOT NULL,
  expected_w integer,
  expected_h integer,
  actual_w integer,
  actual_h integer,
  bg_mode text,
  status text NOT NULL,
  detail text,
  audited_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pod_dim_audit_listing ON public.pod_dimension_audit(listing_id, audited_at DESC);
CREATE INDEX IF NOT EXISTS idx_pod_dim_audit_status ON public.pod_dimension_audit(status, audited_at DESC);

ALTER TABLE public.pod_dimension_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full pod_dimension_audit"
  ON public.pod_dimension_audit
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admin read pod_dimension_audit"
  ON public.pod_dimension_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
