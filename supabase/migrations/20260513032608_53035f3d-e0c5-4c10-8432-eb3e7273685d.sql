
-- Staging: raw discovery output before enrichment
CREATE TABLE IF NOT EXISTS public.raw_buyer_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool TEXT NOT NULL,
  source TEXT NOT NULL,
  company_name TEXT,
  domain TEXT,
  contact_name TEXT,
  contact_title TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  dedupe_key TEXT GENERATED ALWAYS AS (
    coalesce(lower(domain), '') || '|' || coalesce(lower(contact_email), '') || '|' || coalesce(lower(contact_name), '')
  ) STORED,
  enriched_at TIMESTAMPTZ,
  promoted_at TIMESTAMPTZ,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rbc_pool_pending ON public.raw_buyer_candidates(pool) WHERE enriched_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rbc_dedupe ON public.raw_buyer_candidates(dedupe_key);
ALTER TABLE public.raw_buyer_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY rbc_service ON public.raw_buyer_candidates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY rbc_admin_read ON public.raw_buyer_candidates FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Canonical enriched pool ready for outreach
CREATE TABLE IF NOT EXISTS public.buyer_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool TEXT NOT NULL,
  company_name TEXT NOT NULL,
  domain TEXT,
  contact_name TEXT,
  contact_title TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  quality_score INT NOT NULL DEFAULT 5,
  email_verified BOOLEAN DEFAULT false,
  source_chain JSONB DEFAULT '[]'::jsonb,
  enrichment_meta JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'ready', -- ready | sent | bounced | replied | unsub | suppressed
  last_send_at TIMESTAMPTZ,
  send_count INT DEFAULT 0,
  bounce_count INT DEFAULT 0,
  reply_at TIMESTAMPTZ,
  unsub_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_buyer_pools_email ON public.buyer_pools(lower(contact_email));
CREATE INDEX IF NOT EXISTS idx_buyer_pools_pool_status ON public.buyer_pools(pool, status);
CREATE INDEX IF NOT EXISTS idx_buyer_pools_domain ON public.buyer_pools(lower(domain));
ALTER TABLE public.buyer_pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY bp_service ON public.buyer_pools FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY bp_admin_read ON public.buyer_pools FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Apify actor job queue
CREATE TABLE IF NOT EXISTS public.apify_actor_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  input_payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | running | done | failed
  apify_run_id TEXT,
  results_count INT DEFAULT 0,
  cost_usd NUMERIC(10,4) DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_apify_jobs_status ON public.apify_actor_jobs(status, created_at);
ALTER TABLE public.apify_actor_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY apj_service ON public.apify_actor_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY apj_admin_read ON public.apify_actor_jobs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Send log for ramp + throttle + kill-switch
CREATE TABLE IF NOT EXISTS public.cold_email_pool_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES public.buyer_pools(id) ON DELETE CASCADE,
  pool TEXT NOT NULL,
  template_key TEXT NOT NULL,
  domain TEXT,
  resend_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | sent | bounced | delivered
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  bounced_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ceps_pool_day ON public.cold_email_pool_sends(pool, sent_at);
CREATE INDEX IF NOT EXISTS idx_ceps_domain_day ON public.cold_email_pool_sends(lower(domain), sent_at);
ALTER TABLE public.cold_email_pool_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY ceps_service ON public.cold_email_pool_sends FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY ceps_admin_read ON public.cold_email_pool_sends FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Per-pool config (admin-editable, no code deploy)
CREATE TABLE IF NOT EXISTS public.buyer_universe_targets (
  pool TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  target_inboxes INT NOT NULL DEFAULT 1000,
  daily_send_cap INT NOT NULL DEFAULT 100,
  ramp_day_started DATE,
  ramp_floor INT NOT NULL DEFAULT 50,
  ramp_ceiling INT NOT NULL DEFAULT 500,
  ramp_days INT NOT NULL DEFAULT 14,
  source_priority JSONB NOT NULL DEFAULT '["apollo","crustdata","apify","dataforseo","yelp","firecrawl"]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  apify_daily_budget_usd NUMERIC(10,2) DEFAULT 25.00,
  clay_daily_budget_usd NUMERIC(10,2) DEFAULT 20.00,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.buyer_universe_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY but_service ON public.buyer_universe_targets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY but_admin_all ON public.buyer_universe_targets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed all 8 pools
INSERT INTO public.buyer_universe_targets (pool, display_name, target_inboxes, daily_send_cap) VALUES
  ('staffing_agency',  'Staffing & Recruiting Agencies',  3000, 200),
  ('hospital_hr',      'Hospital HR / Nurse Managers',    1200, 80),
  ('trade_contractor', 'Trade Contractors (buyers)',      2500, 150),
  ('mortgage_lo',      'Mortgage LOs / Brokers',          1000, 75),
  ('property_manager', 'Property Managers / Landlords',   1000, 75),
  ('real_estate',      'Real Estate Brokerages & Teams',   800, 60),
  ('dental_medical',   'Dental / Medical Practice Owners', 600, 50),
  ('auto_repair',      'Auto Repair / Multi-Loc Service',  600, 50)
ON CONFLICT (pool) DO NOTHING;

-- Trigger: updated_at
CREATE OR REPLACE FUNCTION public.touch_buyer_pools_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_buyer_pools_touch ON public.buyer_pools;
CREATE TRIGGER trg_buyer_pools_touch BEFORE UPDATE ON public.buyer_pools
  FOR EACH ROW EXECUTE FUNCTION public.touch_buyer_pools_updated_at();
