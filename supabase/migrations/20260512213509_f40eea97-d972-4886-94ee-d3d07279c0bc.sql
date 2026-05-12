
-- Cold email tracking for healthcare staffing agency outreach
CREATE TABLE IF NOT EXISTS public.staffing_agency_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name text NOT NULL,
  contact_name text,
  contact_title text,
  email text NOT NULL,
  phone text,
  city text,
  state text DEFAULT 'MI',
  domain text,
  apollo_id text,
  source text NOT NULL DEFAULT 'apollo',
  status text NOT NULL DEFAULT 'new', -- new | d0_sent | d3_sent | d7_sent | replied | converted | bounced | suppressed
  d0_sent_at timestamptz,
  d3_sent_at timestamptz,
  d7_sent_at timestamptz,
  replied_at timestamptz,
  converted_at timestamptz,
  bounced_at timestamptz,
  notes text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staffing_prospects_email ON public.staffing_agency_prospects(lower(email));
CREATE INDEX IF NOT EXISTS idx_staffing_prospects_status ON public.staffing_agency_prospects(status);
CREATE INDEX IF NOT EXISTS idx_staffing_prospects_created ON public.staffing_agency_prospects(created_at DESC);

ALTER TABLE public.staffing_agency_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_staffing_prospects" ON public.staffing_agency_prospects
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admin_read_staffing_prospects" ON public.staffing_agency_prospects
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
