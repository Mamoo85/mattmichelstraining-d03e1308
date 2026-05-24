
CREATE TABLE IF NOT EXISTS public.gng_translation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id bigint NOT NULL,
  language text NOT NULL,
  title text,
  description_chars int,
  tags_count int,
  status text NOT NULL DEFAULT 'success',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gng_translation_log_listing ON public.gng_translation_log(listing_id, language);
CREATE INDEX IF NOT EXISTS idx_gng_translation_log_created ON public.gng_translation_log(created_at DESC);

CREATE TABLE IF NOT EXISTS public.gng_price_auto_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id bigint NOT NULL,
  old_price_cents int NOT NULL,
  new_price_cents int NOT NULL,
  cost_cents int,
  reason text NOT NULL,
  applied boolean NOT NULL DEFAULT false,
  apply_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gng_price_adj_listing ON public.gng_price_auto_adjustments(listing_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.gng_auto_renew_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  listings_scanned int NOT NULL DEFAULT 0,
  listings_updated int NOT NULL DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE public.gng_translation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gng_price_auto_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gng_auto_renew_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_all_translation_log ON public.gng_translation_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY admin_read_translation_log ON public.gng_translation_log FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY service_role_all_price_adj ON public.gng_price_auto_adjustments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY admin_read_price_adj ON public.gng_price_auto_adjustments FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY service_role_all_renew_log ON public.gng_auto_renew_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY admin_read_renew_log ON public.gng_auto_renew_log FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Cohort/summary view (no purchase table exists yet — derives from product snapshot)
CREATE OR REPLACE VIEW public.gng_catalog_cohort_summary
WITH (security_invoker = true)
AS
SELECT
  date_trunc('month', to_timestamp(etsy_created_ts))::date AS cohort_month,
  count(*) AS listings_created,
  count(*) FILTER (WHERE state = 'active') AS still_active,
  round(avg(price_cents)::numeric / 100.0, 2) AS avg_price_usd,
  round(avg(array_length(tags, 1))::numeric, 1) AS avg_tag_count
FROM public.etsy_products
WHERE etsy_created_ts IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;
