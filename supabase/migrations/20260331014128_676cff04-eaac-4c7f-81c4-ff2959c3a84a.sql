
-- Phase 2-3: Tables for AI agents and efficiency upgrades

-- Upsell tracking
CREATE TABLE IF NOT EXISTS public.upsell_emails_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  service_name TEXT NOT NULL,
  recommended_services TEXT[] DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT now(),
  opened BOOLEAN DEFAULT false
);
ALTER TABLE public.upsell_emails_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access on upsell_emails_sent" ON public.upsell_emails_sent FOR ALL USING (true) WITH CHECK (true);

-- Call summaries
CREATE TABLE IF NOT EXISTS public.call_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID,
  caller_name TEXT,
  caller_phone TEXT,
  intent TEXT,
  urgency TEXT DEFAULT 'normal',
  callback_needed BOOLEAN DEFAULT false,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.call_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access on call_summaries" ON public.call_summaries FOR ALL USING (true) WITH CHECK (true);

-- Phase 4: New service client tables
CREATE TABLE IF NOT EXISTS public.onboarding_agent_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  industry TEXT,
  active BOOLEAN DEFAULT true,
  onboard_count INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.onboarding_agent_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access on onboarding_agent_clients" ON public.onboarding_agent_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.social_proof_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  industry TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  proof_count INTEGER DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.social_proof_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access on social_proof_clients" ON public.social_proof_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.price_monitor_clients (
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
ALTER TABLE public.price_monitor_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access on price_monitor_clients" ON public.price_monitor_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.meeting_prep_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  industry TEXT,
  active BOOLEAN DEFAULT true,
  prep_count INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.meeting_prep_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access on meeting_prep_clients" ON public.meeting_prep_clients FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.directory_submitter_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  industry TEXT,
  address TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  audit_count INTEGER DEFAULT 0,
  last_audit_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.directory_submitter_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access on directory_submitter_clients" ON public.directory_submitter_clients FOR ALL USING (true) WITH CHECK (true);
