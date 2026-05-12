-- TechAlert Staffing pitch page lead capture table
CREATE TABLE IF NOT EXISTS public.techalert_staffing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  agency text,
  county text,
  phone text,
  source text DEFAULT 'free_10_names',
  contacted_at timestamptz,
  converted_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.techalert_staffing_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_techalert_staffing_leads"
  ON public.techalert_staffing_leads
  TO service_role
  USING (true) WITH CHECK (true);

-- Admins can view captured leads to call them back
CREATE POLICY "admin_read_techalert_staffing_leads"
  ON public.techalert_staffing_leads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- public.has_role exists (per project memory). If not, fallback policy:
-- (intentionally omitted — admin-only read)

CREATE INDEX IF NOT EXISTS idx_techalert_staffing_leads_created
  ON public.techalert_staffing_leads(created_at DESC);
