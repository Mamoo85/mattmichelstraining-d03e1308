-- Sandbox tenant config — for the DJ Conley client admin preview
-- and any future client sandbox tenants. Single row per tenant slug.
CREATE TABLE IF NOT EXISTS public.sandbox_tenant_config (
  tenant_slug    text PRIMARY KEY,
  brand_color    text NOT NULL DEFAULT '#27CCC0',
  logo_url       text,
  owner_name     text,
  owner_email    text,
  enabled_radars text[] NOT NULL DEFAULT ARRAY[]::text[],
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sandbox_tenant_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on sandbox_tenant_config"
  ON public.sandbox_tenant_config
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage sandbox_tenant_config"
  ON public.sandbox_tenant_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Seed DJ Conley row
INSERT INTO public.sandbox_tenant_config (tenant_slug, brand_color, logo_url, owner_name, owner_email, enabled_radars)
VALUES (
  'djconley',
  '#27CCC0',
  '/demo-djconley-current/djc-51-logo.png',
  'Pat Michels',
  'pmichels@djconley.com',
  ARRAY['site-radar','missed-call','buyer-radar','fielddesk','techalert','trade-radar','reviews','outreach']
)
ON CONFLICT (tenant_slug) DO NOTHING;