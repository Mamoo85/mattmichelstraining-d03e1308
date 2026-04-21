-- 1. sms_opt_outs: remove public read, restrict to service_role + admin
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sms_opt_outs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.sms_opt_outs', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to sms_opt_outs"
  ON public.sms_opt_outs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read sms_opt_outs"
  ON public.sms_opt_outs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. industry_pulse_clients: remove public read, restrict to service_role + admin
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='industry_pulse_clients'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.industry_pulse_clients', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.industry_pulse_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to industry_pulse_clients"
  ON public.industry_pulse_clients FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read industry_pulse_clients"
  ON public.industry_pulse_clients FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. realtime.messages: lock down channel subscriptions to admins only
-- (App reads field_service_jobs via authenticated REST, not realtime broadcast)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins only realtime access" ON realtime.messages;

CREATE POLICY "Admins only realtime access"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));