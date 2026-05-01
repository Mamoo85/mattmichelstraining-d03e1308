-- 1. migration_status enum + columns on field_crm_clients
DO $$ BEGIN
  CREATE TYPE public.fielddesk_migration_status AS ENUM (
    'none', 'discovery', 'mirror', 'dual_run', 'cutover', 'complete'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.field_crm_clients
  ADD COLUMN IF NOT EXISTS migration_status public.fielddesk_migration_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS dual_run_until DATE;

-- 2. discovery requests table (public form intake)
CREATE TABLE IF NOT EXISTS public.fielddesk_migration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  tech_count INT,
  mode TEXT NOT NULL DEFAULT 'discovery',
  migration_status public.fielddesk_migration_status NOT NULL DEFAULT 'discovery',
  contacted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fielddesk_migration_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (the public form)
CREATE POLICY "Anyone can submit a migration request"
ON public.fielddesk_migration_requests FOR INSERT
WITH CHECK (true);

-- Service role full access
CREATE POLICY "Service role manages migration requests"
ON public.fielddesk_migration_requests FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Admins manage
CREATE POLICY "Admins manage migration requests"
ON public.fielddesk_migration_requests FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_fielddesk_migration_requests_updated_at
BEFORE UPDATE ON public.fielddesk_migration_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_fielddesk_migration_requests_status
  ON public.fielddesk_migration_requests (migration_status, created_at DESC);