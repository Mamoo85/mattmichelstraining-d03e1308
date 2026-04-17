-- Service health tracking
CREATE TABLE public.service_health (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'operational',
  disabled_until TIMESTAMP WITH TIME ZONE,
  last_failure_at TIMESTAMP WITH TIME ZONE,
  last_success_at TIMESTAMP WITH TIME ZONE,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_failure_reason TEXT,
  last_status_code INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.service_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_health admin read"
ON public.service_health FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "service_health service_role full"
ON public.service_health FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_service_health_updated_at
BEFORE UPDATE ON public.service_health
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_service_health_status ON public.service_health(status);

-- Data source endpoint registry
CREATE TABLE public.data_source_endpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_name TEXT NOT NULL UNIQUE,
  primary_url TEXT NOT NULL,
  backup_url TEXT,
  fallback_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_verified_at TIMESTAMP WITH TIME ZONE,
  last_drift_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.data_source_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "data_source_endpoints admin read"
ON public.data_source_endpoints FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "data_source_endpoints service_role full"
ON public.data_source_endpoints FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_data_source_endpoints_updated_at
BEFORE UPDATE ON public.data_source_endpoints
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed services
INSERT INTO public.service_health (service_name, status) VALUES
  ('pdl_api', 'operational'),
  ('firecrawl_api', 'operational'),
  ('lovable_ai_gateway', 'operational'),
  ('anthropic_api', 'operational'),
  ('openai_api', 'operational'),
  ('apollo_api', 'operational'),
  ('michigan_lara', 'operational'),
  ('michigan_open_data', 'operational'),
  ('nursys_api', 'operational')
ON CONFLICT (service_name) DO NOTHING;

-- Seed endpoints
INSERT INTO public.data_source_endpoints (source_name, primary_url, backup_url, fallback_url, notes) VALUES
  ('michigan_lara_bpl', 'https://www.michigan.gov/lara/bureau-list/bpl/professions', 'https://www.michigan.gov/lara/bureau-list/bpl', NULL, 'Michigan LARA Bureau of Professional Licensing'),
  ('michigan_open_data', 'https://data.michigan.gov/resource/professional-licenses.json', 'https://data.michigan.gov/api/views', NULL, 'Michigan Open Data Socrata API'),
  ('michigan_miosha', 'https://www.michigan.gov/leo/bureaus-agencies/miosha', NULL, NULL, 'MIOSHA boiler operator licenses'),
  ('nursys_enotify', 'https://www.nursys.com/NursysEnotify/EnotifyService.svc', NULL, NULL, 'Nursys e-Notify nursing license API'),
  ('npi_registry', 'https://npiregistry.cms.hhs.gov/api/', NULL, NULL, 'CMS NPI Registry (free, no auth)'),
  ('lovable_ai_gateway', 'https://ai.gateway.lovable.dev/v1/chat/completions', NULL, NULL, 'Primary AI gateway'),
  ('anthropic_api', 'https://api.anthropic.com/v1/messages', NULL, NULL, 'Anthropic direct fallback'),
  ('openai_api', 'https://api.openai.com/v1/chat/completions', NULL, NULL, 'OpenAI direct fallback (backup-to-backup)'),
  ('firecrawl_api', 'https://api.firecrawl.dev/v1/scrape', NULL, NULL, 'Firecrawl scrape (fallback to fetch+cheerio)'),
  ('pdl_api', 'https://api.peopledatalabs.com/v5/person/enrich', NULL, NULL, 'People Data Labs (fallback to Apollo)'),
  ('apollo_api', 'https://api.apollo.io/v1/people/match', NULL, NULL, 'Apollo (PDL backup)')
ON CONFLICT (source_name) DO NOTHING;