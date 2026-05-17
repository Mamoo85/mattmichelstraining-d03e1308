
CREATE TABLE IF NOT EXISTS public.pod_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  printify_id text UNIQUE NOT NULL,
  etsy_listing_id bigint UNIQUE,
  niche text NOT NULL,
  product_name text NOT NULL,
  product_type text NOT NULL,
  title text,
  tags text[] DEFAULT '{}',
  description text,
  image_prompt text,
  retail_price_cents integer,
  status text NOT NULL DEFAULT 'published',
  source_run_id uuid,
  source text DEFAULT 'auto',
  published_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pod_listings_niche ON public.pod_listings(niche);
CREATE INDEX IF NOT EXISTS idx_pod_listings_published ON public.pod_listings(published_at DESC);

CREATE TABLE IF NOT EXISTS public.pod_listing_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.pod_listings(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  views integer DEFAULT 0,
  num_favorers integer DEFAULT 0,
  sales_count integer DEFAULT 0,
  revenue_cents integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_pod_stats_listing ON public.pod_listing_stats(listing_id, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS public.pod_publish_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  listing_id uuid REFERENCES public.pod_listings(id) ON DELETE SET NULL,
  product_name text,
  niche text,
  stage text NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  ok boolean NOT NULL,
  http_status integer,
  duration_ms integer,
  error text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pod_logs_run ON public.pod_publish_logs(run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pod_logs_listing ON public.pod_publish_logs(listing_id, created_at);

ALTER TABLE public.pod_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_listing_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_publish_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full pod_listings" ON public.pod_listings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read pod_listings" ON public.pod_listings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "service role full pod_listing_stats" ON public.pod_listing_stats FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read pod_listing_stats" ON public.pod_listing_stats FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "service role full pod_publish_logs" ON public.pod_publish_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read pod_publish_logs" ON public.pod_publish_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW public.pod_niche_performance
WITH (security_invoker = true)
AS
SELECT
  l.niche,
  COUNT(DISTINCT l.id) AS listings,
  COALESCE(SUM(latest.views), 0) AS total_views,
  COALESCE(SUM(latest.num_favorers), 0) AS total_favorites,
  COALESCE(SUM(latest.sales_count), 0) AS total_sales,
  COALESCE(SUM(latest.revenue_cents), 0) AS total_revenue_cents,
  CASE WHEN COALESCE(SUM(latest.views),0) = 0 THEN 0
       ELSE ROUND(100.0 * COALESCE(SUM(latest.sales_count),0) / SUM(latest.views), 2)
  END AS conversion_pct,
  MAX(l.published_at) AS last_published_at
FROM public.pod_listings l
LEFT JOIN LATERAL (
  SELECT views, num_favorers, sales_count, revenue_cents
  FROM public.pod_listing_stats s
  WHERE s.listing_id = l.id
  ORDER BY s.snapshot_date DESC
  LIMIT 1
) latest ON true
GROUP BY l.niche;

GRANT SELECT ON public.pod_niche_performance TO authenticated, service_role;
