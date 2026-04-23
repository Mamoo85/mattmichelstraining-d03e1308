-- Enterprise consultation requests (high-ticket B2B intel products)
CREATE TABLE public.enterprise_consultation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  product_interest TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_consultation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access enterprise_consultation_requests"
  ON public.enterprise_consultation_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view enterprise consultation requests"
  ON public.enterprise_consultation_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update enterprise consultation requests"
  ON public.enterprise_consultation_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can submit consultation requests"
  ON public.enterprise_consultation_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(name) > 0 AND length(name) <= 100
    AND length(company) > 0 AND length(company) <= 200
    AND length(email) > 0 AND length(email) <= 255
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(product_interest) > 0 AND length(product_interest) <= 100
    AND (message IS NULL OR length(message) <= 2000)
    AND (phone IS NULL OR length(phone) <= 30)
  );

CREATE TRIGGER update_enterprise_consultation_requests_updated_at
  BEFORE UPDATE ON public.enterprise_consultation_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_enterprise_consultation_requests_status ON public.enterprise_consultation_requests(status);
CREATE INDEX idx_enterprise_consultation_requests_created_at ON public.enterprise_consultation_requests(created_at DESC);

-- Brother claimed domains (anti-collision for Mortgage Radar)
CREATE TABLE public.brother_claimed_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  company_name TEXT,
  claimed_by_email TEXT NOT NULL DEFAULT 'brother@detroitwebagent.com',
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brother_claimed_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access brother_claimed_domains"
  ON public.brother_claimed_domains
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage brother_claimed_domains"
  ON public.brother_claimed_domains
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_brother_claimed_domains_updated_at
  BEFORE UPDATE ON public.brother_claimed_domains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_brother_claimed_domains_domain ON public.brother_claimed_domains(domain);
CREATE INDEX idx_brother_claimed_domains_active ON public.brother_claimed_domains(active);