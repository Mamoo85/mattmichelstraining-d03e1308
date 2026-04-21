-- Add free dead-lead quota tracking to contractor_clients
ALTER TABLE public.contractor_clients
  ADD COLUMN IF NOT EXISTS free_dead_leads_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_dead_leads_quota INTEGER NOT NULL DEFAULT 40;

-- Track monthly ad spend + agent-recommended budget per contractor
CREATE TABLE IF NOT EXISTS public.contractor_ad_spend (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractor_clients(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  spend_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  recommended_budget_next_30d NUMERIC(10,2),
  leads_delivered INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contractor_id, month)
);
CREATE INDEX IF NOT EXISTS idx_contractor_ad_spend_contractor ON public.contractor_ad_spend(contractor_id, month DESC);

ALTER TABLE public.contractor_ad_spend ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access ad_spend"
  ON public.contractor_ad_spend FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "admins can view ad_spend"
  ON public.contractor_ad_spend FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Smart Ad Budget Agent adjustment log
CREATE TABLE IF NOT EXISTS public.contractor_ad_budget_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractor_clients(id) ON DELETE CASCADE,
  old_budget NUMERIC(10,2),
  new_budget NUMERIC(10,2) NOT NULL,
  reason TEXT NOT NULL,
  agent TEXT NOT NULL DEFAULT 'dwa-ad-optimizer',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contractor_ad_budget_log_contractor ON public.contractor_ad_budget_log(contractor_id, created_at DESC);

ALTER TABLE public.contractor_ad_budget_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access budget_log"
  ON public.contractor_ad_budget_log FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "admins can view budget_log"
  ON public.contractor_ad_budget_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Lead Boost purchases (optional contractor upsell, 20% mgmt fee)
CREATE TABLE IF NOT EXISTS public.contractor_lead_boosts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractor_clients(id) ON DELETE CASCADE,
  stripe_charge_id TEXT,
  stripe_session_id TEXT,
  stripe_subscription_id TEXT,
  boost_amount NUMERIC(10,2) NOT NULL,
  fee_amount NUMERIC(10,2) NOT NULL,
  net_ad_spend NUMERIC(10,2) NOT NULL,
  boost_type TEXT NOT NULL DEFAULT 'one_time',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_contractor_lead_boosts_contractor ON public.contractor_lead_boosts(contractor_id, created_at DESC);

ALTER TABLE public.contractor_lead_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access lead_boosts"
  ON public.contractor_lead_boosts FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "admins can view lead_boosts"
  ON public.contractor_lead_boosts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger for contractor_ad_spend
CREATE TRIGGER update_contractor_ad_spend_updated_at
  BEFORE UPDATE ON public.contractor_ad_spend
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();