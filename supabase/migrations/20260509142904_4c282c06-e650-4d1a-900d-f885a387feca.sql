
-- Counsel Records Search — paid lawyer subscribers
CREATE TABLE IF NOT EXISTS public.counsel_search_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  email TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  firm_name TEXT,
  bar_number TEXT,
  state TEXT DEFAULT 'MI',
  phone TEXT,
  tier TEXT NOT NULL DEFAULT 'solo' CHECK (tier IN ('solo','monitoring')),
  monitoring_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  trial_active BOOLEAN NOT NULL DEFAULT FALSE,
  permissible_purpose_ack_at TIMESTAMPTZ,
  dashboard_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.counsel_search_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass" ON public.counsel_search_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "user_reads_own_client" ON public.counsel_search_clients FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_counsel_clients_email ON public.counsel_search_clients(email);
CREATE INDEX IF NOT EXISTS idx_counsel_clients_user ON public.counsel_search_clients(user_id);

-- Free-trial quota: 7 searches before paywall
CREATE TABLE IF NOT EXISTS public.counsel_search_quota (
  user_id UUID NOT NULL PRIMARY KEY,
  email TEXT,
  free_searches_used INT NOT NULL DEFAULT 0,
  permissible_purpose_ack_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.counsel_search_quota ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass" ON public.counsel_search_quota FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "user_reads_own_quota" ON public.counsel_search_quota FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Per-search audit log (replaces tenant_intel_searches going forward)
CREATE TABLE IF NOT EXISTS public.counsel_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  email TEXT,
  query_name TEXT NOT NULL,
  aliases TEXT[],
  query_city TEXT,
  query_state TEXT,
  case_matter TEXT,
  permissible_purpose TEXT,
  result_summary JSONB,
  full_results JSONB,
  sources_hit INT,
  sources_returned INT,
  total_hits INT,
  high_priority_hits INT,
  elapsed_ms INT,
  was_paid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.counsel_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass" ON public.counsel_searches FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "user_reads_own_searches" ON public.counsel_searches FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_counsel_searches_user ON public.counsel_searches(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_counsel_searches_name ON public.counsel_searches(query_name);

-- Saved subjects for monitoring tier
CREATE TABLE IF NOT EXISTS public.counsel_saved_subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT,
  subject_name TEXT NOT NULL,
  aliases TEXT[],
  city TEXT,
  state TEXT,
  case_matter TEXT,
  last_checked_at TIMESTAMPTZ,
  last_hit_count INT DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.counsel_saved_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass" ON public.counsel_saved_subjects FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "user_manages_own_subjects" ON public.counsel_saved_subjects FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_counsel_subjects_user ON public.counsel_saved_subjects(user_id, active);
