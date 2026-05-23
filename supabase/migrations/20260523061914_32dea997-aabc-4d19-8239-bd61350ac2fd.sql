CREATE TABLE IF NOT EXISTS public.printify_products (
  product_id text PRIMARY KEY,
  shop_id text,
  blueprint_id integer,
  print_provider_id integer,
  title text,
  description text,
  tags text[],
  retail_cents integer,
  cost_cents integer,
  profit_cents integer,
  etsy_listing_id bigint,
  visible boolean DEFAULT true,
  is_locked boolean DEFAULT false,
  published_to_etsy boolean DEFAULT false,
  pf_updated_at timestamptz,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_printify_products_etsy_listing ON public.printify_products(etsy_listing_id);
CREATE INDEX IF NOT EXISTS idx_printify_products_visible ON public.printify_products(visible);

ALTER TABLE public.printify_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role manages printify_products"
  ON public.printify_products FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admin reads printify_products"
  ON public.printify_products FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.gng_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  drift_dollars numeric DEFAULT 0,
  notes text
);

ALTER TABLE public.gng_audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role manages gng_audit_runs"
  ON public.gng_audit_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admin reads gng_audit_runs"
  ON public.gng_audit_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));