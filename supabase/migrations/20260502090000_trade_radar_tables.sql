-- Trade Radar: clients + leads tables for 7 trade verticals.
-- Mirrors mortgage_radar_* structure. Zero changes to mortgage tables.

CREATE TABLE IF NOT EXISTS public.trade_radar_clients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  email               TEXT NOT NULL,
  contact_name        TEXT,
  business_name       TEXT,
  phone               TEXT,
  vertical            TEXT NOT NULL,  -- roofing|hvac|plumbing|electrical|pest_control|gutters|painting
  zip_codes           TEXT[] NOT NULL DEFAULT '{}',
  active              BOOLEAN NOT NULL DEFAULT true,
  stripe_customer_id  TEXT,
  stripe_subscription_id TEXT,
  trial_ends_at       TIMESTAMPTZ,
  dashboard_token     TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  UNIQUE (email, vertical)
);

ALTER TABLE public.trade_radar_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_trade_radar_clients"
  ON public.trade_radar_clients FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_all_trade_radar_clients"
  ON public.trade_radar_clients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.trade_radar_leads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  vertical            TEXT NOT NULL,
  full_name           TEXT,
  address             TEXT,
  city                TEXT,
  zip                 TEXT,
  lat                 NUMERIC,
  lon                 NUMERIC,
  county              TEXT,
  region              TEXT,
  signal_type         TEXT,
  signal_detail       TEXT,
  signal_date         DATE,
  score               INTEGER NOT NULL DEFAULT 5,
  suggested_opener    TEXT,
  best_call_window    TEXT,
  estimated_value     NUMERIC,
  intel_highlights    TEXT[],
  signal_count        INTEGER NOT NULL DEFAULT 1,
  last_signal_at      TIMESTAMPTZ DEFAULT now(),
  source_method       TEXT,
  raw_source_data     JSONB,
  quarantine_reason   TEXT,
  status              TEXT NOT NULL DEFAULT 'new',
  UNIQUE (vertical, address, zip)
);

ALTER TABLE public.trade_radar_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_trade_radar_leads"
  ON public.trade_radar_leads FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admin_all_trade_radar_leads"
  ON public.trade_radar_leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Indexes for daily digest queries
CREATE INDEX IF NOT EXISTS idx_trade_radar_leads_vertical_created
  ON public.trade_radar_leads (vertical, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trade_radar_leads_zip
  ON public.trade_radar_leads (zip);

CREATE INDEX IF NOT EXISTS idx_trade_radar_leads_score
  ON public.trade_radar_leads (score DESC);

CREATE INDEX IF NOT EXISTS idx_trade_radar_clients_vertical_active
  ON public.trade_radar_clients (vertical, active);
