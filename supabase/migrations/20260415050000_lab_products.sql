-- Lab Products: Domain Breach Report + Keyword Gap Report
-- One-time transactional products for cold-traffic ads

CREATE TABLE IF NOT EXISTS public.domain_breach_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email    text NOT NULL,
  domain            text NOT NULL,
  stripe_session_id text,
  breach_count      int DEFAULT 0,
  affected_emails   int DEFAULT 0,
  report_sent_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.domain_breach_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.domain_breach_orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_domain_breach_orders_email ON public.domain_breach_orders (customer_email);
CREATE INDEX IF NOT EXISTS idx_domain_breach_orders_session ON public.domain_breach_orders (stripe_session_id);

CREATE TABLE IF NOT EXISTS public.keyword_gap_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email    text NOT NULL,
  your_domain       text NOT NULL,
  competitor_domain text NOT NULL,
  stripe_session_id text,
  gaps_found        int DEFAULT 0,
  report_sent_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.keyword_gap_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.keyword_gap_orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_keyword_gap_orders_email ON public.keyword_gap_orders (customer_email);
CREATE INDEX IF NOT EXISTS idx_keyword_gap_orders_session ON public.keyword_gap_orders (stripe_session_id);
