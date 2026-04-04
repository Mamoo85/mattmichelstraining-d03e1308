
CREATE TABLE IF NOT EXISTS public.obituary_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  funeral_home_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.obituary_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.obituary_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.sermon_prep_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  church_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.sermon_prep_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.sermon_prep_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.hoa_secretary_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  hoa_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hoa_secretary_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.hoa_secretary_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.hoa_violation_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  hoa_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.hoa_violation_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.hoa_violation_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.rfp_alert_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.rfp_alert_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.rfp_alert_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.franchise_analyzer_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.franchise_analyzer_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.franchise_analyzer_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.insurance_drip_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.insurance_drip_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.insurance_drip_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.str_reputation_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.str_reputation_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.str_reputation_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.grant_discovery_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  org_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.grant_discovery_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.grant_discovery_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.ag_price_alert_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ag_price_alert_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.ag_price_alert_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.landlord_letter_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.landlord_letter_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.landlord_letter_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.trade_show_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.trade_show_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.trade_show_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.price_intelligence_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.price_intelligence_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.price_intelligence_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.citation_monitor_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.citation_monitor_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.citation_monitor_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.menu_engineering_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  restaurant_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.menu_engineering_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.menu_engineering_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.fitness_report_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.fitness_report_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.fitness_report_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.gov_meeting_tracker_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.gov_meeting_tracker_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.gov_meeting_tracker_clients FOR ALL USING (true) WITH CHECK (true);
