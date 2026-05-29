
-- site_scanner_leads
CREATE TABLE public.site_scanner_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  url TEXT NOT NULL,
  scores JSONB,
  report_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.site_scanner_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.site_scanner_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_insert" ON public.site_scanner_leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_insert" ON public.site_scanner_leads FOR INSERT TO authenticated WITH CHECK (true);

-- competitor_threat_log
CREATE TABLE public.competitor_threat_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID,
  keyword TEXT NOT NULL,
  competitor TEXT,
  client_position INT,
  competitor_position INT,
  alerted_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.competitor_threat_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.competitor_threat_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- cross_sell_queue
CREATE TABLE public.cross_sell_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_id TEXT,
  email TEXT NOT NULL,
  business_name TEXT,
  send_at TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.cross_sell_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.cross_sell_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- client_ranking_snapshots
CREATE TABLE public.client_ranking_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID,
  keyword TEXT NOT NULL,
  position INT,
  local_pack BOOLEAN DEFAULT false,
  checked_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.client_ranking_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.client_ranking_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

-- generated_content_drafts
CREATE TABLE public.generated_content_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry TEXT,
  title TEXT NOT NULL,
  body TEXT,
  status TEXT DEFAULT 'draft',
  client_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.generated_content_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.generated_content_drafts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- exit_intent_leads
CREATE TABLE public.exit_intent_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.exit_intent_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON public.exit_intent_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_insert" ON public.exit_intent_leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth_insert" ON public.exit_intent_leads FOR INSERT TO authenticated WITH CHECK (true);
