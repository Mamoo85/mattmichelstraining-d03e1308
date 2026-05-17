
-- Track trend scanner runs and product publications
CREATE TABLE public.etsy_trend_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  niche TEXT NOT NULL,
  niche_rationale TEXT,
  trend_signals JSONB DEFAULT '[]'::jsonb,
  products_planned JSONB DEFAULT '[]'::jsonb,
  products_published JSONB DEFAULT '[]'::jsonb,
  products_failed JSONB DEFAULT '[]'::jsonb,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_etsy_trend_runs_date ON public.etsy_trend_runs(run_date DESC);
CREATE INDEX idx_etsy_trend_runs_niche ON public.etsy_trend_runs(niche);

ALTER TABLE public.etsy_trend_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_etsy_trend_runs"
  ON public.etsy_trend_runs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_read_etsy_trend_runs"
  ON public.etsy_trend_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Schedule the scanner daily at 13:00 UTC (9am ET)
SELECT cron.schedule(
  'etsy-trend-scanner-daily',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/etsy-trend-scanner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT')
    ),
    body := jsonb_build_object('source', 'cron', 'time', now())
  );
  $$
);
