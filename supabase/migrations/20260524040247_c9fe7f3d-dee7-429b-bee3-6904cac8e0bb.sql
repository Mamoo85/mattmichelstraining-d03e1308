-- gng_dead_sku_log
CREATE TABLE IF NOT EXISTS public.gng_dead_sku_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id bigint NOT NULL,
  title text,
  url text,
  last_updated_ts bigint,
  price_cents integer,
  flagged_reason text NOT NULL,
  reviewed_at timestamptz,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, flagged_reason)
);
ALTER TABLE public.gng_dead_sku_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full gng_dead_sku_log" ON public.gng_dead_sku_log
  TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admins read gng_dead_sku_log" ON public.gng_dead_sku_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- gng_trend_signals
CREATE TABLE IF NOT EXISTS public.gng_trend_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag text NOT NULL,
  frequency integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'etsy_scrape',
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gng_trend_signals_captured ON public.gng_trend_signals (captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_gng_trend_signals_tag ON public.gng_trend_signals (tag);
ALTER TABLE public.gng_trend_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full gng_trend_signals" ON public.gng_trend_signals
  TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admins read gng_trend_signals" ON public.gng_trend_signals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Cron schedules
DO $$
DECLARE service_key text;
BEGIN
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT' LIMIT 1;

  PERFORM cron.unschedule('gng-dead-sku-sweeper-weekly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='gng-dead-sku-sweeper-weekly');
  PERFORM cron.unschedule('gng-trend-scraper-weekly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='gng-trend-scraper-weekly');
  PERFORM cron.unschedule('etsy-tag-refresh-weekly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='etsy-tag-refresh-weekly');

  PERFORM cron.schedule('gng-dead-sku-sweeper-weekly', '30 13 * * 1', format($cmd$
    SELECT net.http_post(
      url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/gng-dead-sku-sweeper',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),
      body := '{}'::jsonb
    );
  $cmd$, service_key));

  PERFORM cron.schedule('gng-trend-scraper-weekly', '0 14 * * 0', format($cmd$
    SELECT net.http_post(
      url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/gng-trend-scraper',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),
      body := '{}'::jsonb
    );
  $cmd$, service_key));

  PERFORM cron.schedule('etsy-tag-refresh-weekly', '0 15 * * 1', format($cmd$
    SELECT net.http_post(
      url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/etsy-tag-refresh',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),
      body := '{}'::jsonb
    );
  $cmd$, service_key));
END $$;