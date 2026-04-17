-- Batch 4: Final Radar Enhancements

-- TR-20: Multi-seat support for Talent Radar agencies
CREATE TABLE IF NOT EXISTS public.radar_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  client_table TEXT NOT NULL DEFAULT 'hire_alert_clients',
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'recruiter',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (client_id, email)
);
ALTER TABLE public.radar_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_team_members" ON public.radar_team_members FOR ALL TO service_role USING (true) WITH CHECK (true);

-- TR-19: Hire confirmation flow
CREATE TABLE IF NOT EXISTS public.radar_hire_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  candidate_id UUID,
  candidate_name TEXT,
  prompted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  outcome TEXT,
  estimated_fee_saved_usd INTEGER DEFAULT 8000,
  notes TEXT
);
ALTER TABLE public.radar_hire_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_hire_conf" ON public.radar_hire_confirmations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- DR-19: Signal archive log
CREATE TABLE IF NOT EXISTS public.radar_signal_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT DEFAULT 'expired_30d'
);
ALTER TABLE public.radar_signal_archives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_archives" ON public.radar_signal_archives FOR ALL TO service_role USING (true) WITH CHECK (true);

-- LR-16: Territory locks
CREATE TABLE IF NOT EXISTS public.radar_territory_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL,
  contractor_email TEXT,
  county TEXT NOT NULL,
  trade TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  monthly_price_cents INTEGER DEFAULT 49900,
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (county, trade, active) DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE public.radar_territory_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_territory" ON public.radar_territory_locks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- LR-18: Lead win/loss outcomes
CREATE TABLE IF NOT EXISTS public.radar_lead_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL,
  lead_id UUID,
  outcome TEXT NOT NULL,
  revenue_usd NUMERIC,
  notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.radar_lead_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_outcomes" ON public.radar_lead_outcomes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- LR-19: Auto-response SMS templates
CREATE TABLE IF NOT EXISTS public.radar_auto_response_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL,
  trade TEXT,
  template_body TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.radar_auto_response_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_autoresp" ON public.radar_auto_response_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- LR-20: Annual subscription tracking
CREATE TABLE IF NOT EXISTS public.radar_annual_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  product TEXT NOT NULL,
  stripe_subscription_id TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  renews_at TIMESTAMPTZ,
  amount_paid_cents INTEGER,
  months_included INTEGER DEFAULT 12,
  active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.radar_annual_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_annual" ON public.radar_annual_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_team_members_client ON public.radar_team_members(client_id);
CREATE INDEX IF NOT EXISTS idx_hire_conf_client ON public.radar_hire_confirmations(client_id);
CREATE INDEX IF NOT EXISTS idx_territory_active ON public.radar_territory_locks(county, trade) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_outcomes_contractor ON public.radar_lead_outcomes(contractor_id);