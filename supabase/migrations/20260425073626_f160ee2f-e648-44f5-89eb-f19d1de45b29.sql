-- ============================================================
-- Detroit Lead Exchange v2 — Phase 1 schema
-- ============================================================

-- 1. Pricing rules per vertical
CREATE TABLE IF NOT EXISTS public.lead_exchange_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical text NOT NULL UNIQUE,
  base_price_cents integer NOT NULL DEFAULT 4900,
  fresh_multiplier numeric(4,2) NOT NULL DEFAULT 1.50,  -- <24h
  warm_multiplier numeric(4,2) NOT NULL DEFAULT 1.00,   -- 1-7d
  aged_multiplier numeric(4,2) NOT NULL DEFAULT 0.50,   -- >7d
  signal_strong_bonus_cents integer NOT NULL DEFAULT 2000,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_exchange_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_pricing" ON public.lead_exchange_pricing
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins_all_pricing" ON public.lead_exchange_pricing
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed defaults
INSERT INTO public.lead_exchange_pricing (vertical, base_price_cents, fresh_multiplier, signal_strong_bonus_cents, notes) VALUES
  ('roofing',     5900, 1.60, 3000, 'Storm + permit signals'),
  ('hvac',        4900, 1.50, 2000, 'Replacement intent'),
  ('plumbing',    4900, 1.40, 2000, 'Emergency uplift'),
  ('electrical',  4900, 1.40, 2000, 'Panel upgrade signals'),
  ('refi',        7900, 1.80, 4000, 'Equity + rate trigger'),
  ('legal',       9900, 1.50, 3000, 'PI / probate / family law'),
  ('cdl_rn',      3900, 1.30, 1500, 'Newly-licensed talent'),
  ('govcon',      4900, 1.20, 2000, 'SAM.gov RFQs')
ON CONFLICT (vertical) DO NOTHING;

-- 2. Exchange listings (admin layer over contractor_leads)
CREATE TABLE IF NOT EXISTS public.lead_exchange_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.contractor_leads(id) ON DELETE CASCADE,
  vertical text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','sold','pulled','refunded','internal_only')),
  sale_mode text NOT NULL DEFAULT 'solo' CHECK (sale_mode IN ('solo','auction_3','auto_route')),
  price_cents integer,
  price_override boolean NOT NULL DEFAULT false,
  internal_only boolean NOT NULL DEFAULT false,
  killed_at timestamptz,
  killed_reason text,
  listed_at timestamptz,
  sold_at timestamptz,
  buyer_email text,
  refunded_at timestamptz,
  refund_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lex_listings_status ON public.lead_exchange_listings(status);
CREATE INDEX IF NOT EXISTS idx_lex_listings_vertical ON public.lead_exchange_listings(vertical);
CREATE INDEX IF NOT EXISTS idx_lex_listings_listed_at ON public.lead_exchange_listings(listed_at DESC) WHERE status = 'live';

ALTER TABLE public.lead_exchange_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_listings" ON public.lead_exchange_listings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins_all_listings" ON public.lead_exchange_listings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Enrichment Gate results (6-point check)
CREATE TABLE IF NOT EXISTS public.lead_exchange_enrichment_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.contractor_leads(id) ON DELETE CASCADE,
  phone_tcpa_ok boolean NOT NULL DEFAULT false,
  email_deliverable_ok boolean NOT NULL DEFAULT false,
  geocoded_ok boolean NOT NULL DEFAULT false,
  signal_verified_ok boolean NOT NULL DEFAULT false,
  ai_summary_ok boolean NOT NULL DEFAULT false,
  provenance_ok boolean NOT NULL DEFAULT false,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_exchange_enrichment_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_enrich" ON public.lead_exchange_enrichment_checks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins_all_enrich" ON public.lead_exchange_enrichment_checks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Buyer post-purchase reviews (drives Trust Wall)
CREATE TABLE IF NOT EXISTS public.lead_purchase_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.lead_exchange_listings(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.contractor_leads(id) ON DELETE SET NULL,
  buyer_email text NOT NULL,
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  outcome_text text,
  connected boolean,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lpr_published ON public.lead_purchase_reviews(is_published, created_at DESC);

ALTER TABLE public.lead_purchase_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_reviews" ON public.lead_purchase_reviews
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins_all_reviews" ON public.lead_purchase_reviews
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Public can read approved/published reviews for Trust Wall
CREATE POLICY "public_read_published_reviews" ON public.lead_purchase_reviews
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

-- 5. Inventory thresholds (API spend governor)
CREATE TABLE IF NOT EXISTS public.lead_inventory_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical text NOT NULL UNIQUE,
  min_inventory integer NOT NULL DEFAULT 10,
  daily_spend_cap_cents integer NOT NULL DEFAULT 2500,
  paid_apis_enabled boolean NOT NULL DEFAULT false,
  last_evaluated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_inventory_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_thresholds" ON public.lead_inventory_thresholds
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins_all_thresholds" ON public.lead_inventory_thresholds
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.lead_inventory_thresholds (vertical, min_inventory, daily_spend_cap_cents) VALUES
  ('roofing', 10, 2500), ('hvac', 10, 2500), ('plumbing', 10, 2500),
  ('electrical', 10, 2500), ('refi', 5, 5000), ('legal', 5, 5000),
  ('cdl_rn', 10, 2500), ('govcon', 10, 2500)
ON CONFLICT (vertical) DO NOTHING;

-- 6. Buyer graduation ladder state
CREATE TABLE IF NOT EXISTS public.buyer_graduation_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_email text NOT NULL UNIQUE,
  tier text NOT NULL DEFAULT 'one_off' CHECK (tier IN ('one_off','watcher','first_look','territory')),
  total_purchases integer NOT NULL DEFAULT 0,
  purchases_30d integer NOT NULL DEFAULT 0,
  last_purchase_at timestamptz,
  last_pitch_watcher_at timestamptz,
  last_pitch_first_look_at timestamptz,
  last_pitch_territory_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.buyer_graduation_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_grad" ON public.buyer_graduation_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins_all_grad" ON public.buyer_graduation_state
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at triggers
CREATE TRIGGER trg_lex_pricing_updated BEFORE UPDATE ON public.lead_exchange_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lex_listings_updated BEFORE UPDATE ON public.lead_exchange_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lex_thresholds_updated BEFORE UPDATE ON public.lead_inventory_thresholds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lex_grad_updated BEFORE UPDATE ON public.buyer_graduation_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
