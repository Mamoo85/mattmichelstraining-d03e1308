-- High-Volume Buyer Permit Package — supply house subscription product
CREATE TABLE IF NOT EXISTS public.high_volume_buyer_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  contact_name TEXT,
  target_trades TEXT[] DEFAULT ARRAY['hvac','plumbing','electrical']::TEXT[],
  target_counties TEXT[] DEFAULT ARRAY['Wayne','Oakland','Macomb']::TEXT[],
  min_permit_count INTEGER DEFAULT 5,
  active BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  last_digest_sent_at TIMESTAMPTZ,
  digest_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.high_volume_buyer_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_hvb_clients"
  ON public.high_volume_buyer_clients
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "admins_view_hvb_clients"
  ON public.high_volume_buyer_clients
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_hvb_clients_active ON public.high_volume_buyer_clients(active) WHERE active = true;
CREATE INDEX idx_hvb_clients_email ON public.high_volume_buyer_clients(email);

-- Digest send log
CREATE TABLE IF NOT EXISTS public.high_volume_buyer_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.high_volume_buyer_clients(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  buyer_count INTEGER DEFAULT 0,
  total_permit_value NUMERIC(12,2) DEFAULT 0,
  payload JSONB
);

ALTER TABLE public.high_volume_buyer_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_hvb_digests"
  ON public.high_volume_buyer_digests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "admins_view_hvb_digests"
  ON public.high_volume_buyer_digests
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_hvb_digests_client ON public.high_volume_buyer_digests(client_id, sent_at DESC);

-- updated_at trigger
CREATE TRIGGER update_hvb_clients_updated_at
  BEFORE UPDATE ON public.high_volume_buyer_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();