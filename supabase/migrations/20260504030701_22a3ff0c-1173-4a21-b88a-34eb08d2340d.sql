-- Per-client lead action tracking (leads themselves are shared)
CREATE TABLE IF NOT EXISTS public.trade_radar_lead_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.trade_radar_clients(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.trade_radar_leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','called','pass','snoozed','won','lost')),
  snooze_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, lead_id)
);

CREATE TABLE IF NOT EXISTS public.mortgage_radar_lead_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.mortgage_radar_clients(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.mortgage_radar_leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','called','pass','snoozed','won','lost')),
  snooze_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, lead_id)
);

ALTER TABLE public.trade_radar_lead_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mortgage_radar_lead_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_trade_lead_actions" ON public.trade_radar_lead_actions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_trade_lead_actions" ON public.trade_radar_lead_actions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "client_rw_trade_lead_actions" ON public.trade_radar_lead_actions
  FOR ALL TO authenticated
  USING (client_id IN (SELECT id FROM public.trade_radar_clients WHERE email = auth.jwt() ->> 'email'))
  WITH CHECK (client_id IN (SELECT id FROM public.trade_radar_clients WHERE email = auth.jwt() ->> 'email'));

CREATE POLICY "service_role_all_mortgage_lead_actions" ON public.mortgage_radar_lead_actions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_mortgage_lead_actions" ON public.mortgage_radar_lead_actions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "client_rw_mortgage_lead_actions" ON public.mortgage_radar_lead_actions
  FOR ALL TO authenticated
  USING (client_id IN (SELECT id FROM public.mortgage_radar_clients WHERE email = auth.jwt() ->> 'email'))
  WITH CHECK (client_id IN (SELECT id FROM public.mortgage_radar_clients WHERE email = auth.jwt() ->> 'email'));

CREATE INDEX IF NOT EXISTS idx_trade_lead_actions_client ON public.trade_radar_lead_actions(client_id, status);
CREATE INDEX IF NOT EXISTS idx_mortgage_lead_actions_client ON public.mortgage_radar_lead_actions(client_id, status);

CREATE TRIGGER update_trade_lead_actions_updated_at BEFORE UPDATE ON public.trade_radar_lead_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_mortgage_lead_actions_updated_at BEFORE UPDATE ON public.mortgage_radar_lead_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();