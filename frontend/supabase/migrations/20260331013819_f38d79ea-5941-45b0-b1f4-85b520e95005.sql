
-- Phase 1: Create all missing B2B client tables for automated service fulfillment

-- 1. Local SEO clients (referenced by ai-local-seo-writer but table was missing)
CREATE TABLE IF NOT EXISTS public.local_seo_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  industry TEXT,
  city TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  page_count INTEGER DEFAULT 0,
  last_generated_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.local_seo_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on local_seo_clients" ON public.local_seo_clients FOR ALL USING (true) WITH CHECK (true);

-- 2. Reputation clients
CREATE TABLE IF NOT EXISTS public.reputation_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  industry TEXT,
  city TEXT,
  google_place_id TEXT,
  active BOOLEAN DEFAULT true,
  report_count INTEGER DEFAULT 0,
  last_report_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.reputation_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on reputation_clients" ON public.reputation_clients FOR ALL USING (true) WITH CHECK (true);

-- 3. Reputation reports tracking
CREATE TABLE IF NOT EXISTS public.reputation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.reputation_clients(id) ON DELETE CASCADE,
  report_html TEXT,
  review_count INTEGER DEFAULT 0,
  avg_rating NUMERIC(2,1),
  sent_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.reputation_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on reputation_reports" ON public.reputation_reports FOR ALL USING (true) WITH CHECK (true);

-- 4. Newsletter service clients
CREATE TABLE IF NOT EXISTS public.newsletter_service_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  industry TEXT,
  subscriber_list TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  send_count INTEGER DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.newsletter_service_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on newsletter_service_clients" ON public.newsletter_service_clients FOR ALL USING (true) WITH CHECK (true);

-- 5. FAQ refresh clients
CREATE TABLE IF NOT EXISTS public.faq_refresh_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  industry TEXT,
  website_url TEXT,
  active BOOLEAN DEFAULT true,
  refresh_count INTEGER DEFAULT 0,
  last_refreshed_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.faq_refresh_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on faq_refresh_clients" ON public.faq_refresh_clients FOR ALL USING (true) WITH CHECK (true);

-- 6. Blog post clients
CREATE TABLE IF NOT EXISTS public.blog_post_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  industry TEXT,
  target_keywords TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  post_count INTEGER DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.blog_post_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on blog_post_clients" ON public.blog_post_clients FOR ALL USING (true) WITH CHECK (true);

-- 7. Ads copy clients
CREATE TABLE IF NOT EXISTS public.ads_copy_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  industry TEXT,
  target_keywords TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  batch_count INTEGER DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ads_copy_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on ads_copy_clients" ON public.ads_copy_clients FOR ALL USING (true) WITH CHECK (true);

-- 8. Competitor watch clients
CREATE TABLE IF NOT EXISTS public.competitor_watch_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  industry TEXT,
  competitor_urls TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  report_count INTEGER DEFAULT 0,
  last_report_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.competitor_watch_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on competitor_watch_clients" ON public.competitor_watch_clients FOR ALL USING (true) WITH CHECK (true);

-- 9. Payment chaser clients (referenced by existing function but missing)
CREATE TABLE IF NOT EXISTS public.payment_chaser_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  industry TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  chase_count INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.payment_chaser_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on payment_chaser_clients" ON public.payment_chaser_clients FOR ALL USING (true) WITH CHECK (true);
