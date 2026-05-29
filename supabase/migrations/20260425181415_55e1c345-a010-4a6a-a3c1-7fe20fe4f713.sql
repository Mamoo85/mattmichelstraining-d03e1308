
-- Court CMS scraped records
CREATE TABLE public.court_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL,
  court TEXT NOT NULL,
  case_type TEXT,
  filed_at DATE,
  party_plaintiff TEXT,
  party_defendant TEXT,
  attorney_name TEXT,
  zip TEXT,
  county TEXT,
  source_url TEXT,
  raw JSONB,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (court, case_number)
);

CREATE INDEX idx_court_cases_filed_at ON public.court_cases (filed_at DESC);
CREATE INDEX idx_court_cases_zip ON public.court_cases (zip);
CREATE INDEX idx_court_cases_type ON public.court_cases (case_type);

ALTER TABLE public.court_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_court_cases"
ON public.court_cases FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Magic-link tokens for buyer portal
CREATE TABLE public.marketplace_magic_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_magic_tokens_email ON public.marketplace_magic_tokens (buyer_email);
CREATE INDEX idx_magic_tokens_expires ON public.marketplace_magic_tokens (expires_at);

ALTER TABLE public.marketplace_magic_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_magic_tokens"
ON public.marketplace_magic_tokens FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
