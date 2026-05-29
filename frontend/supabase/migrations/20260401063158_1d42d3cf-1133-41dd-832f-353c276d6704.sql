
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.client_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.web_design_leads(id) ON DELETE SET NULL,
    user_id UUID,
    service_key TEXT NOT NULL,
    service_name TEXT NOT NULL,
    price_cents INTEGER NOT NULL DEFAULT 0,
    stripe_subscription_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cancelled_at TIMESTAMPTZ
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

ALTER TABLE public.client_addons ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access on client_addons' AND tablename = 'client_addons') THEN
    CREATE POLICY "Service role full access on client_addons" ON public.client_addons FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own addons' AND tablename = 'client_addons') THEN
    CREATE POLICY "Users can view own addons" ON public.client_addons FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage all addons' AND tablename = 'client_addons') THEN
    CREATE POLICY "Admins can manage all addons" ON public.client_addons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
