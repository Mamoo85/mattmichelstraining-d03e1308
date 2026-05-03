CREATE TABLE IF NOT EXISTS public.link_audit_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_key text NOT NULL,
  channel text NOT NULL,
  url text NOT NULL,
  status_code int,
  ok boolean NOT NULL DEFAULT false,
  response_ms int,
  error text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_link_audit_product_checked ON public.link_audit_results(product_key, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_link_audit_failures ON public.link_audit_results(checked_at DESC) WHERE ok = false;

ALTER TABLE public.link_audit_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_link_audit"
ON public.link_audit_results FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "admins_read_link_audit"
ON public.link_audit_results FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));