
-- Create 9 missing client tables for webhook product handlers

CREATE TABLE IF NOT EXISTS public.abandoned_cart_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.abandoned_cart_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.abandoned_cart_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.annual_review_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.annual_review_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.annual_review_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.client_report_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.client_report_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.client_report_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.linkedin_outreach_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.linkedin_outreach_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.linkedin_outreach_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.new_mover_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.new_mover_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.new_mover_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.podcast_pitch_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.podcast_pitch_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.podcast_pitch_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.restaurant_menu_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.restaurant_menu_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.restaurant_menu_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.testimonial_harvester_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.testimonial_harvester_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.testimonial_harvester_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.trade_show_followup_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.trade_show_followup_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.trade_show_followup_clients FOR ALL USING (true) WITH CHECK (true);
