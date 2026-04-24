
-- ============================================================
-- Golden Ticket Marketplace v2 — Session 1 Schema
-- ============================================================

-- ---------- 1. NEW TABLES ----------

CREATE TABLE IF NOT EXISTS public.marketplace_lead_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  product text NOT NULL,
  buyer_email text,
  stripe_session_id text,
  status text NOT NULL DEFAULT 'soft_lock',
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  claimed_at timestamptz,
  sold_at timestamptz,
  amount_cents integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mll_lead ON public.marketplace_lead_locks(lead_id, product);
CREATE INDEX IF NOT EXISTS idx_mll_status ON public.marketplace_lead_locks(status, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mll_unique_active
  ON public.marketplace_lead_locks(lead_id, product)
  WHERE status IN ('soft_lock','claimed','sold');

CREATE TABLE IF NOT EXISTS public.marketplace_buyer_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  product text NOT NULL,
  visitor_hash text,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mbv_lead_time ON public.marketplace_buyer_views(lead_id, viewed_at DESC);

CREATE TABLE IF NOT EXISTS public.marketplace_lead_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  product text NOT NULL,
  buyer_email text NOT NULL,
  storage_path text NOT NULL,
  signed_url text,
  signed_url_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mlp_lead_buyer ON public.marketplace_lead_pdfs(lead_id, buyer_email);

CREATE TABLE IF NOT EXISTS public.marketplace_lead_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  product text NOT NULL,
  share_token text NOT NULL UNIQUE,
  shared_by_email text NOT NULL,
  shared_to_email text,
  contact_redacted boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  redeemed_at timestamptz,
  redeemed_count integer NOT NULL DEFAULT 0,
  max_redeems integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mls_token ON public.marketplace_lead_shares(share_token);

CREATE TABLE IF NOT EXISTS public.marketplace_saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_email text NOT NULL,
  buyer_phone text,
  product text NOT NULL,
  zip_codes text[] DEFAULT '{}',
  cities text[] DEFAULT '{}',
  min_score integer DEFAULT 7,
  signal_types text[] DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  last_alerted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mss_active ON public.marketplace_saved_searches(active, product);

CREATE TABLE IF NOT EXISTS public.marketplace_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_email text NOT NULL,
  lead_id uuid NOT NULL,
  product text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mdis_unique ON public.marketplace_dismissals(buyer_email, lead_id);

CREATE TABLE IF NOT EXISTS public.marketplace_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_email text NOT NULL,
  lead_id uuid NOT NULL,
  product text NOT NULL,
  watched_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mwatch_unique ON public.marketplace_watches(buyer_email, lead_id);

CREATE TABLE IF NOT EXISTS public.signal_strength_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product text NOT NULL,
  signal_type text NOT NULL,
  age_max_hours integer NOT NULL,
  min_score integer NOT NULL DEFAULT 0,
  tier text NOT NULL CHECK (tier IN ('hot','warm','cool')),
  display_label text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ssr_lookup ON public.signal_strength_rules(product, signal_type, priority);

-- ---------- 2. RLS — locked down (service-role only) ----------
ALTER TABLE public.marketplace_lead_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_buyer_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_lead_pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_lead_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_strength_rules ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'marketplace_lead_locks','marketplace_buyer_views','marketplace_lead_pdfs',
    'marketplace_lead_shares','marketplace_saved_searches','marketplace_dismissals',
    'marketplace_watches','signal_strength_rules'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS service_all ON public.%I', t);
    EXECUTE format('CREATE POLICY service_all ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS public_read_rules ON public.signal_strength_rules;
CREATE POLICY public_read_rules ON public.signal_strength_rules FOR SELECT TO anon, authenticated USING (true);

-- ---------- 3. COLUMNS on source tables ----------
ALTER TABLE public.mortgage_radar_leads
  ADD COLUMN IF NOT EXISTS equity_range_low_cents bigint,
  ADD COLUMN IF NOT EXISTS equity_range_high_cents bigint,
  ADD COLUMN IF NOT EXISTS year_built integer,
  ADD COLUMN IF NOT EXISTS last_sale_price_cents bigint,
  ADD COLUMN IF NOT EXISTS last_sale_date date,
  ADD COLUMN IF NOT EXISTS lot_sqft integer,
  ADD COLUMN IF NOT EXISTS building_sqft integer,
  ADD COLUMN IF NOT EXISTS signal_strength_tier text,
  ADD COLUMN IF NOT EXISTS human_summary text,
  ADD COLUMN IF NOT EXISTS buyer_type text,
  ADD COLUMN IF NOT EXISTS provenance_source_urls jsonb,
  ADD COLUMN IF NOT EXISTS provenance_screenshot_paths jsonb,
  ADD COLUMN IF NOT EXISTS signal_velocity numeric,
  ADD COLUMN IF NOT EXISTS zip_heat_index integer,
  ADD COLUMN IF NOT EXISTS days_on_radar integer,
  ADD COLUMN IF NOT EXISTS nearby_signal_count integer,
  ADD COLUMN IF NOT EXISTS est_loan_low_cents bigint,
  ADD COLUMN IF NOT EXISTS est_loan_high_cents bigint,
  ADD COLUMN IF NOT EXISTS score_percentile integer,
  ADD COLUMN IF NOT EXISTS tcpa_clear boolean,
  ADD COLUMN IF NOT EXISTS marketplace_enriched_at timestamptz;

ALTER TABLE public.industry_pulse_signals
  ADD COLUMN IF NOT EXISTS equity_range_low_cents bigint,
  ADD COLUMN IF NOT EXISTS equity_range_high_cents bigint,
  ADD COLUMN IF NOT EXISTS year_built integer,
  ADD COLUMN IF NOT EXISTS last_sale_price_cents bigint,
  ADD COLUMN IF NOT EXISTS last_sale_date date,
  ADD COLUMN IF NOT EXISTS signal_strength_tier text,
  ADD COLUMN IF NOT EXISTS human_summary text,
  ADD COLUMN IF NOT EXISTS buyer_type text,
  ADD COLUMN IF NOT EXISTS suggested_opener jsonb,
  ADD COLUMN IF NOT EXISTS provenance_source_urls jsonb,
  ADD COLUMN IF NOT EXISTS provenance_screenshot_paths jsonb,
  ADD COLUMN IF NOT EXISTS signal_velocity numeric,
  ADD COLUMN IF NOT EXISTS zip_heat_index integer,
  ADD COLUMN IF NOT EXISTS days_on_radar integer,
  ADD COLUMN IF NOT EXISTS nearby_signal_count integer,
  ADD COLUMN IF NOT EXISTS est_loan_low_cents bigint,
  ADD COLUMN IF NOT EXISTS est_loan_high_cents bigint,
  ADD COLUMN IF NOT EXISTS score_percentile integer,
  ADD COLUMN IF NOT EXISTS tcpa_clear boolean,
  ADD COLUMN IF NOT EXISTS marketplace_enriched_at timestamptz;

ALTER TABLE public.hire_alert_candidates
  ADD COLUMN IF NOT EXISTS signal_strength_tier text,
  ADD COLUMN IF NOT EXISTS human_summary text,
  ADD COLUMN IF NOT EXISTS buyer_type text,
  ADD COLUMN IF NOT EXISTS suggested_opener jsonb,
  ADD COLUMN IF NOT EXISTS provenance_source_urls jsonb,
  ADD COLUMN IF NOT EXISTS provenance_screenshot_paths jsonb,
  ADD COLUMN IF NOT EXISTS signal_velocity numeric,
  ADD COLUMN IF NOT EXISTS zip_heat_index integer,
  ADD COLUMN IF NOT EXISTS days_on_radar integer,
  ADD COLUMN IF NOT EXISTS nearby_signal_count integer,
  ADD COLUMN IF NOT EXISTS score_percentile integer,
  ADD COLUMN IF NOT EXISTS tcpa_clear boolean,
  ADD COLUMN IF NOT EXISTS marketplace_enriched_at timestamptz;

ALTER TABLE public.mortgage_radar_clients
  ADD COLUMN IF NOT EXISTS alert_prefs jsonb DEFAULT '{}'::jsonb;

-- ---------- 4. Storage buckets ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-provenance-screenshots', 'lead-provenance-screenshots', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-dossier-pdfs', 'lead-dossier-pdfs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS marketplace_screenshots_service ON storage.objects;
CREATE POLICY marketplace_screenshots_service ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id IN ('lead-provenance-screenshots','lead-dossier-pdfs'))
  WITH CHECK (bucket_id IN ('lead-provenance-screenshots','lead-dossier-pdfs'));

-- ---------- 5. Seed signal_strength_rules ----------
INSERT INTO public.signal_strength_rules (product, signal_type, age_max_hours, min_score, tier, display_label, priority) VALUES
  ('mortgage','lis_pendens',          72,  7, 'hot',  'Hot — fresh foreclosure filing', 10),
  ('mortgage','lis_pendens',         336,  6, 'warm', 'Warm — recent foreclosure filing', 20),
  ('mortgage','lis_pendens',        9999,  0, 'cool', 'Cool — older foreclosure filing', 30),
  ('mortgage','high_equity_renovation', 168, 7, 'hot',  'Hot — large renovation permit', 10),
  ('mortgage','high_equity_renovation', 720, 5, 'warm', 'Warm — recent renovation permit', 20),
  ('mortgage','high_equity_renovation',9999, 0, 'cool', 'Cool — aging renovation signal', 30),
  ('mortgage','new_business',         168, 7, 'hot',  'Hot — newly formed LLC', 10),
  ('mortgage','new_business',        9999, 0, 'warm', 'Warm — recent LLC formation', 20),
  ('talent','miosha',                  72, 7, 'hot',  'Hot — newly licensed', 10),
  ('talent','miosha',                 720, 5, 'warm', 'Warm — recent license', 20),
  ('talent','miosha',                9999, 0, 'cool', 'Cool — older license signal', 30),
  ('talent','job_board',               48, 7, 'hot',  'Hot — actively job-seeking', 10),
  ('talent','job_board',              336, 5, 'warm', 'Warm — recently posted', 20),
  ('talent','job_board',             9999, 0, 'cool', 'Cool — aging post', 30),
  ('demand','permit_surge',            72, 7, 'hot',  'Hot — permit surge in area', 10),
  ('demand','permit_surge',           720, 0, 'warm', 'Warm — permit activity', 20),
  ('growth','sam_gov_award',          168, 0, 'hot',  'Hot — federal contract win', 10),
  ('supply','sam_gov_award',          168, 0, 'hot',  'Hot — federal contract win', 10)
ON CONFLICT DO NOTHING;

-- ---------- 6. Cleanup helper ----------
CREATE OR REPLACE FUNCTION public.marketplace_cleanup_expired_locks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.marketplace_lead_locks
  SET status = 'expired'
  WHERE status = 'soft_lock' AND expires_at < now();
END $$;

-- ---------- 7. Unified marketplace view ----------
-- Note: mortgage_radar_leads.suggested_opener is pre-existing TEXT; cast to jsonb safely
CREATE OR REPLACE VIEW public.unified_lead_marketplace_view
WITH (security_invoker = true) AS
SELECT
  m.id::text AS id,
  'mortgage'::text AS product,
  COALESCE(m.signal_type, 'mortgage_radar') AS signal_type,
  m.signal_strength_tier,
  m.score,
  m.score_percentile,
  m.signal_velocity,
  m.zip_heat_index,
  m.days_on_radar,
  m.nearby_signal_count,
  m.equity_range_low_cents,
  m.equity_range_high_cents,
  m.year_built,
  m.last_sale_price_cents,
  m.last_sale_date,
  m.est_loan_low_cents,
  m.est_loan_high_cents,
  m.tcpa_clear,
  m.human_summary,
  m.buyer_type,
  CASE WHEN m.suggested_opener IS NULL THEN NULL::jsonb
       WHEN m.suggested_opener::text ~ '^\s*[\{\[]' THEN m.suggested_opener::jsonb
       ELSE jsonb_build_object('text', m.suggested_opener) END AS suggested_opener,
  m.provenance_source_urls,
  m.created_at,
  m.city,
  m.state,
  m.zip
FROM public.mortgage_radar_leads m
UNION ALL
SELECT
  c.id::text AS id,
  'talent'::text AS product,
  COALESCE(c.source, 'talent_radar') AS signal_type,
  c.signal_strength_tier,
  c.score,
  c.score_percentile,
  c.signal_velocity,
  c.zip_heat_index,
  c.days_on_radar,
  c.nearby_signal_count,
  NULL::bigint AS equity_range_low_cents,
  NULL::bigint AS equity_range_high_cents,
  NULL::integer AS year_built,
  NULL::bigint AS last_sale_price_cents,
  NULL::date AS last_sale_date,
  NULL::bigint AS est_loan_low_cents,
  NULL::bigint AS est_loan_high_cents,
  c.tcpa_clear,
  c.human_summary,
  c.buyer_type,
  c.suggested_opener,
  c.provenance_source_urls,
  c.created_at,
  c.city,
  c.state,
  c.zip
FROM public.hire_alert_candidates c
UNION ALL
SELECT
  s.id::text AS id,
  CASE WHEN s.signal_type IN ('permit_surge','demand_signal') THEN 'demand'
       WHEN s.signal_type IN ('sam_gov_award','contract_award') THEN 'growth'
       ELSE 'supply' END AS product,
  s.signal_type,
  s.signal_strength_tier,
  s.confidence AS score,
  s.score_percentile,
  s.signal_velocity,
  s.zip_heat_index,
  s.days_on_radar,
  s.nearby_signal_count,
  s.equity_range_low_cents,
  s.equity_range_high_cents,
  s.year_built,
  s.last_sale_price_cents,
  s.last_sale_date,
  s.est_loan_low_cents,
  s.est_loan_high_cents,
  s.tcpa_clear,
  s.human_summary,
  s.buyer_type,
  s.suggested_opener,
  s.provenance_source_urls,
  s.created_at,
  NULL::text AS city,
  NULL::text AS state,
  NULL::text AS zip
FROM public.industry_pulse_signals s;
