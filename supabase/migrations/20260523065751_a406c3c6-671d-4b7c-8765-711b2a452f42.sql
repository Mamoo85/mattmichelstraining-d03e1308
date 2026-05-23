CREATE TABLE IF NOT EXISTS public.gng_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('price_floor','drift_fix','message_reply','shop_edit','other')),
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  listing_id bigint,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','applied','failed','expired')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  applied_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  apply_result jsonb,
  notify_phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gng_approvals_status ON public.gng_approvals (status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_gng_approvals_short ON public.gng_approvals (short_code);

ALTER TABLE public.gng_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_gng_approvals" ON public.gng_approvals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_read_gng_approvals" ON public.gng_approvals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.gng_drift_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id bigint NOT NULL,
  printify_product_id text,
  etsy_price_cents int,
  printify_price_cents int,
  drift_cents int,
  cost_cents int,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution text
);
CREATE INDEX IF NOT EXISTS idx_drift_listing ON public.gng_drift_snapshots (listing_id, detected_at DESC);

ALTER TABLE public.gng_drift_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_drift" ON public.gng_drift_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_read_drift" ON public.gng_drift_snapshots FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));