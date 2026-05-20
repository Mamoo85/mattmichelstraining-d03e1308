
-- 1. Etsy products mirror
CREATE TABLE IF NOT EXISTS public.etsy_products (
  listing_id bigint PRIMARY KEY,
  shop_id bigint NOT NULL,
  title text NOT NULL,
  description text,
  price_cents integer,
  currency text DEFAULT 'USD',
  url text,
  state text DEFAULT 'active',
  tags text[] DEFAULT '{}',
  materials text[] DEFAULT '{}',
  quantity integer,
  etsy_created_ts bigint,
  etsy_updated_ts bigint,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_etsy_products_state ON public.etsy_products(state);
CREATE INDEX IF NOT EXISTS idx_etsy_products_synced ON public.etsy_products(last_synced_at DESC);
ALTER TABLE public.etsy_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active etsy_products" ON public.etsy_products
  FOR SELECT TO anon, authenticated USING (state = 'active');
CREATE POLICY "service role full etsy_products" ON public.etsy_products
  TO service_role USING (true) WITH CHECK (true);

-- 2. Etsy product images
CREATE TABLE IF NOT EXISTS public.etsy_product_images (
  listing_id bigint NOT NULL REFERENCES public.etsy_products(listing_id) ON DELETE CASCADE,
  image_id bigint NOT NULL,
  rank integer NOT NULL DEFAULT 1,
  url_570xN text,
  url_fullxfull text,
  url_75x75 text,
  alt_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, image_id)
);
CREATE INDEX IF NOT EXISTS idx_etsy_images_rank ON public.etsy_product_images(listing_id, rank);
ALTER TABLE public.etsy_product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read etsy_product_images" ON public.etsy_product_images
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service role full etsy_product_images" ON public.etsy_product_images
  TO service_role USING (true) WITH CHECK (true);

-- 3. Token refresh audit log
CREATE TABLE IF NOT EXISTS public.etsy_token_refresh_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL,
  expires_at timestamptz,
  refreshed boolean DEFAULT false,
  error text
);
CREATE INDEX IF NOT EXISTS idx_etsy_token_refresh_ran ON public.etsy_token_refresh_log(ran_at DESC);
ALTER TABLE public.etsy_token_refresh_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read etsy_token_refresh_log" ON public.etsy_token_refresh_log
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "service role full etsy_token_refresh_log" ON public.etsy_token_refresh_log
  TO service_role USING (true) WITH CHECK (true);

-- 4. POD image regression log
CREATE TABLE IF NOT EXISTS public.pod_image_regression_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.pod_listings(id) ON DELETE SET NULL,
  printify_id text,
  product_type text,
  ran_at timestamptz NOT NULL DEFAULT now(),
  pass boolean NOT NULL,
  reason text,
  width integer,
  height integer,
  expected_width integer,
  expected_height integer,
  edge_white_pct numeric,
  caller text
);
CREATE INDEX IF NOT EXISTS idx_pod_regression_ran ON public.pod_image_regression_log(ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_pod_regression_pass ON public.pod_image_regression_log(pass);
ALTER TABLE public.pod_image_regression_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read pod_image_regression_log" ON public.pod_image_regression_log
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "service role full pod_image_regression_log" ON public.pod_image_regression_log
  TO service_role USING (true) WITH CHECK (true);

-- 5. Cron jobs
DO $$
DECLARE
  service_key text;
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT';

  -- Unschedule existing (idempotent)
  PERFORM cron.unschedule('etsy-token-refresh-6h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='etsy-token-refresh-6h');
  PERFORM cron.unschedule('etsy-product-sync-hourly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='etsy-product-sync-hourly');
  PERFORM cron.unschedule('pod-republish-resume-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='pod-republish-resume-daily');

  PERFORM cron.schedule(
    'etsy-token-refresh-6h',
    '0 */6 * * *',
    format($cmd$
      SELECT net.http_post(
        url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/etsy-token-refresh',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),
        body := '{}'::jsonb
      );
    $cmd$, service_key)
  );

  PERFORM cron.schedule(
    'etsy-product-sync-hourly',
    '7 * * * *',
    format($cmd$
      SELECT net.http_post(
        url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/etsy-product-sync',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),
        body := '{}'::jsonb
      );
    $cmd$, service_key)
  );

  PERFORM cron.schedule(
    'pod-republish-resume-daily',
    '0 8 * * *',  -- 04:00 ET = 08:00 UTC (winter); fine year-round
    format($cmd$
      SELECT net.http_post(
        url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/pod-republish-resume',
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),
        body := '{}'::jsonb
      );
    $cmd$, service_key)
  );
END $$;
