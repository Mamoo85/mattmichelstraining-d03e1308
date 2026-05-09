
ALTER TABLE public.hire_alert_clients
  ADD COLUMN IF NOT EXISTS trade_focus text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN public.hire_alert_clients.trade_focus IS
  'Allowed values: welder_fabricator, hvac, electrical, plumbing, cdl, nurse, healthcare, industrial, commercial';

CREATE TABLE IF NOT EXISTS public.talent_prospect_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid,
  company text NOT NULL,
  domain text,
  ceo_name text,
  ceo_first_name text,
  ceo_email text,
  ceo_phone text,
  industry text,
  trade_focus text,
  employee_count int,
  city text,
  state text,
  recent_signal text,
  source text,
  score int DEFAULT 0,
  cold_email_subject text,
  cold_email_draft text,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  meta jsonb DEFAULT '{}'::jsonb,
  fingerprint text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_talent_prospect_list_status ON public.talent_prospect_list(status);
CREATE INDEX IF NOT EXISTS idx_talent_prospect_list_run ON public.talent_prospect_list(run_id);
CREATE INDEX IF NOT EXISTS idx_talent_prospect_list_score ON public.talent_prospect_list(score DESC);

ALTER TABLE public.talent_prospect_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON public.talent_prospect_list;
CREATE POLICY "service_role_all" ON public.talent_prospect_list
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admins_read" ON public.talent_prospect_list;
CREATE POLICY "admins_read" ON public.talent_prospect_list
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins_write" ON public.talent_prospect_list;
CREATE POLICY "admins_write" ON public.talent_prospect_list
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
