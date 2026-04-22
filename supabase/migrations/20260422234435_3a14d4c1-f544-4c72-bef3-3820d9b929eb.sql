-- Buyer Radar: named-account watchlist + RFQ postings
-- Reuses existing industry_pulse_clients (buyer_type='supplier', vertical='steel|fab_metal|...') from migration 20260417002201

CREATE TABLE IF NOT EXISTS public.buyer_radar_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.industry_pulse_clients(id) ON DELETE CASCADE,
  business_name   text NOT NULL,
  domain          text,
  naics_codes     text[],
  city            text,
  state           text DEFAULT 'MI',
  monitor_until   timestamptz,
  last_scanned_at timestamptz,
  last_signal     jsonb,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.buyer_radar_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_buyer_radar_accounts"
  ON public.buyer_radar_accounts FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_bra_client ON public.buyer_radar_accounts (client_id);
CREATE INDEX IF NOT EXISTS idx_bra_scan_due ON public.buyer_radar_accounts (last_scanned_at NULLS FIRST);

CREATE TABLE IF NOT EXISTS public.buyer_radar_rfqs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source             text NOT NULL,
  source_id          text,
  title              text NOT NULL,
  agency             text,
  description        text,
  naics              text,
  state              text,
  city               text,
  url                text,
  posted_at          timestamptz,
  due_at             timestamptz,
  estimated_value    numeric,
  raw                jsonb,
  notified_client_ids uuid[] DEFAULT ARRAY[]::uuid[],
  detected_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.buyer_radar_rfqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_buyer_radar_rfqs"
  ON public.buyer_radar_rfqs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS uq_brr_source ON public.buyer_radar_rfqs (source, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brr_naics ON public.buyer_radar_rfqs (naics);
CREATE INDEX IF NOT EXISTS idx_brr_detected ON public.buyer_radar_rfqs (detected_at DESC);