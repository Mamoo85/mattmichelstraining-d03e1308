
CREATE TABLE IF NOT EXISTS public.dwa_spend_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text,
  provider text NOT NULL,
  cost_usd numeric(10,4) NOT NULL DEFAULT 0,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dwa_spend_ledger_created ON public.dwa_spend_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dwa_spend_ledger_provider ON public.dwa_spend_ledger(provider, created_at DESC);
ALTER TABLE public.dwa_spend_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_ledger" ON public.dwa_spend_ledger FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.dwa_budget_state (
  id int PRIMARY KEY DEFAULT 1,
  weekly_cap_usd numeric(10,2) NOT NULL DEFAULT 5.00,
  week_start timestamptz NOT NULL DEFAULT date_trunc('week', now()),
  spent_this_week_usd numeric(10,4) NOT NULL DEFAULT 0,
  paused boolean NOT NULL DEFAULT false,
  auto_lift_on_first_sale boolean NOT NULL DEFAULT true,
  lifted_at timestamptz,
  lifted_reason text,
  warning_80_sent_at timestamptz,
  warning_100_sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
ALTER TABLE public.dwa_budget_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_state" ON public.dwa_budget_state FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_read_state" ON public.dwa_budget_state FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.dwa_budget_state (id, weekly_cap_usd, auto_lift_on_first_sale)
VALUES (1, 5.00, true)
ON CONFLICT (id) DO NOTHING;
