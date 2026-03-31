
-- 1. AI Employee Handbook Generator clients
CREATE TABLE public.handbook_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  industry TEXT,
  state TEXT DEFAULT 'MI',
  employee_count INTEGER,
  stripe_customer_id TEXT,
  active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  send_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.handbook_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_handbook" ON public.handbook_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. AI Grant Finder clients
CREATE TABLE public.grant_finder_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  industry TEXT,
  employee_count INTEGER,
  annual_revenue TEXT,
  location TEXT DEFAULT 'Michigan',
  stripe_customer_id TEXT,
  active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  send_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.grant_finder_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_grant_finder" ON public.grant_finder_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. AI Review Response clients
CREATE TABLE public.review_response_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  industry TEXT,
  google_place_id TEXT,
  brand_voice TEXT,
  stripe_customer_id TEXT,
  active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  send_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.review_response_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_review_response" ON public.review_response_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. AI Competitive Battlecard clients
CREATE TABLE public.battlecard_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  industry TEXT,
  competitor_names TEXT[],
  competitor_urls TEXT[],
  stripe_customer_id TEXT,
  active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  send_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.battlecard_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_battlecard" ON public.battlecard_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. AI Market Intelligence Brief clients
CREATE TABLE public.market_intel_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  industry TEXT,
  focus_topics TEXT[],
  competitors TEXT[],
  location TEXT DEFAULT 'Michigan',
  stripe_customer_id TEXT,
  active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  send_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.market_intel_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_market_intel" ON public.market_intel_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
