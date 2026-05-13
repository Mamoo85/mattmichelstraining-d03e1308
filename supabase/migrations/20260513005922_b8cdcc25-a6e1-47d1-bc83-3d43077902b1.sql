-- Inventory Sentinel: watches every sellable product's data table
-- and alerts + auto-backfills if rows < threshold or stale.

CREATE TABLE IF NOT EXISTS public.inventory_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  inventory_table text NOT NULL,        -- e.g. 'hire_alert_candidates'
  freshness_column text DEFAULT 'created_at',
  min_rows int NOT NULL DEFAULT 25,
  freshness_days int NOT NULL DEFAULT 7,
  backfill_function text,                -- edge function to invoke if stale, e.g. 'talent-radar-nurse-scanner'
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug text NOT NULL,
  status text NOT NULL,                  -- 'green' | 'yellow' | 'red'
  row_count int NOT NULL,
  fresh_row_count int NOT NULL,
  threshold int NOT NULL,
  message text,
  backfill_invoked boolean DEFAULT false,
  backfill_result jsonb,
  sms_sent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_product_created
  ON public.inventory_alerts (product_slug, created_at DESC);

ALTER TABLE public.inventory_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass watchlist" ON public.inventory_watchlist
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role bypass alerts" ON public.inventory_alerts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed initial watchlist
INSERT INTO public.inventory_watchlist (product_slug, display_name, inventory_table, freshness_column, min_rows, freshness_days, backfill_function)
VALUES
  ('techalert_healthcare', 'TechAlert Healthcare', 'hire_alert_candidates', 'created_at', 25, 7, 'talent-radar-nurse-scanner'),
  ('staffing_agency_prospects', 'Staffing Agency Cold Email Pool', 'staffing_agency_prospects', 'created_at', 50, 14, 'staffing-agency-prospector'),
  ('mortgage_radar_leads', 'Mortgage Radar Leads', 'mortgage_radar_leads', 'last_signal_at', 10, 3, 'mortgage-radar-scanner'),
  ('trade_radar_leads', 'Trade Radar Leads', 'trade_radar_leads', 'created_at', 20, 7, 'trade-radar-scanner')
ON CONFLICT (product_slug) DO NOTHING;