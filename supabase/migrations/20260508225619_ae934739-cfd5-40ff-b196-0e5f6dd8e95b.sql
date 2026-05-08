
-- Trial Hub: unified dashboard for bundled trials
CREATE TABLE IF NOT EXISTS public.trial_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_token TEXT NOT NULL UNIQUE,
  email TEXT,
  company_name TEXT,
  display_name TEXT,
  products JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_bundles_token ON public.trial_bundles(bundle_token);

ALTER TABLE public.trial_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_trial_bundles" ON public.trial_bundles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anon can SELECT only when they know the token (handled by edge function w/ SRK; no anon read).
-- Source registry: visibility for stub/live/blocked sources
CREATE TABLE IF NOT EXISTS public.source_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product TEXT NOT NULL,
  source_key TEXT NOT NULL,
  source_name TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'stub' CHECK (status IN ('live','stub','needs_key','blocked')),
  blocker TEXT,
  required_secret TEXT,
  last_attempted_at TIMESTAMPTZ,
  last_result_count INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product, source_key)
);

ALTER TABLE public.source_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_source_registry" ON public.source_registry
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admin_read_source_registry" ON public.source_registry
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
