-- Creates 12 client tables referenced in stripe-webhook but missing migrations.
-- Without these, any customer paying for these services gets a silent DB failure.

CREATE TABLE IF NOT EXISTS public.caption_pack_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  industry TEXT,
  platforms TEXT DEFAULT 'Facebook, Instagram',
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_sent_at TIMESTAMPTZ,
  send_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.caption_pack_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role" ON public.caption_pack_clients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.job_posting_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_sent_at TIMESTAMPTZ,
  send_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.job_posting_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role" ON public.job_posting_clients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.med_spa_marketing_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  city TEXT,
  services TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_sent_at TIMESTAMPTZ,
  send_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.med_spa_marketing_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role" ON public.med_spa_marketing_clients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.real_estate_drip_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  city TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_sent_at TIMESTAMPTZ,
  send_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.real_estate_drip_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role" ON public.real_estate_drip_clients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.podcast_show_notes_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  podcast_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_sent_at TIMESTAMPTZ,
  send_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.podcast_show_notes_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role" ON public.podcast_show_notes_clients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.church_newsletter_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  denomination TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_sent_at TIMESTAMPTZ,
  send_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.church_newsletter_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role" ON public.church_newsletter_clients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.property_mgmt_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  units INT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_sent_at TIMESTAMPTZ,
  send_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.property_mgmt_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role" ON public.property_mgmt_clients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.franchise_ops_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  locations INT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_sent_at TIMESTAMPTZ,
  send_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.franchise_ops_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role" ON public.franchise_ops_clients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.ecommerce_listings_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  platform TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_sent_at TIMESTAMPTZ,
  send_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ecommerce_listings_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role" ON public.ecommerce_listings_clients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.financial_advisor_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  designation TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_sent_at TIMESTAMPTZ,
  send_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.financial_advisor_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role" ON public.financial_advisor_clients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.vet_marketing_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  business_type TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_sent_at TIMESTAMPTZ,
  send_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.vet_marketing_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role" ON public.vet_marketing_clients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.trucking_docs_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  trucks INT,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_sent_at TIMESTAMPTZ,
  send_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.trucking_docs_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role" ON public.trucking_docs_clients
  FOR ALL TO service_role USING (true) WITH CHECK (true);
