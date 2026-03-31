
-- ═══════════════════════════════════════════════════════════════════════
-- Unified B2B Client Pipeline: b2b_clients + service_subscriptions
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.b2b_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  owner_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  industry TEXT,
  city TEXT,
  state TEXT DEFAULT 'MI',
  stripe_customer_id TEXT,
  source TEXT DEFAULT 'checkout',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

CREATE TABLE IF NOT EXISTS public.service_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.b2b_clients(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  fulfillment_stage TEXT NOT NULL DEFAULT 'New Lead - Action Required',
  monthly_price INTEGER,
  admin_notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.b2b_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_b2b_clients" ON public.b2b_clients
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admin_read_b2b_clients" ON public.b2b_clients
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "service_role_full_service_subscriptions" ON public.service_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admin_all_service_subscriptions" ON public.service_subscriptions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_b2b_clients_email ON public.b2b_clients(email);
CREATE INDEX idx_service_subs_client ON public.service_subscriptions(client_id);
CREATE INDEX idx_service_subs_stage ON public.service_subscriptions(fulfillment_stage);

-- Updated_at triggers
CREATE TRIGGER b2b_clients_updated_at BEFORE UPDATE ON public.b2b_clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER service_subscriptions_updated_at BEFORE UPDATE ON public.service_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for instant admin CRM updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.b2b_clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_subscriptions;
