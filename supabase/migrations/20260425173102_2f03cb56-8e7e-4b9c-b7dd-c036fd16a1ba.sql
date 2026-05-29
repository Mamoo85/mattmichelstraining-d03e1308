CREATE TABLE IF NOT EXISTS public.marketplace_zip_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_email TEXT NOT NULL,
  zip TEXT,
  product TEXT,
  trade TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_zip_alerts_email
  ON public.marketplace_zip_alerts (lower(buyer_email));
CREATE INDEX IF NOT EXISTS idx_mp_zip_alerts_match
  ON public.marketplace_zip_alerts (zip, product, trade) WHERE active = true;

ALTER TABLE public.marketplace_zip_alerts ENABLE ROW LEVEL SECURITY;

-- Anyone can sign up for an alert (anonymous landing page form)
CREATE POLICY "Anyone can create a zip alert"
  ON public.marketplace_zip_alerts
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    buyer_email IS NOT NULL
    AND length(buyer_email) BETWEEN 3 AND 254
    AND buyer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  );

-- Service role bypass (backend reads/writes)
CREATE POLICY "Service role full access on zip alerts"
  ON public.marketplace_zip_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at
CREATE TRIGGER update_marketplace_zip_alerts_updated_at
  BEFORE UPDATE ON public.marketplace_zip_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();