CREATE TABLE IF NOT EXISTS public.agency_contact_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name TEXT NOT NULL UNIQUE,
  contact_first_name TEXT,
  contact_last_name TEXT,
  contact_full_name TEXT,
  contact_title TEXT,
  contact_email TEXT,
  contact_linkedin TEXT,
  email_status TEXT,
  source TEXT,
  domain TEXT,
  enriched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.agency_contact_enrichments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access agency_contact_enrichments"
  ON public.agency_contact_enrichments
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admins manage agency_contact_enrichments"
  ON public.agency_contact_enrichments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_agency_contact_enrichments_agency
  ON public.agency_contact_enrichments(agency_name);