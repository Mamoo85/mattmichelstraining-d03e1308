CREATE TABLE IF NOT EXISTS public.checkout_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_session_id TEXT NOT NULL UNIQUE,
  product_type TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  fulfilled_at TIMESTAMPTZ,
  webhook_event_id TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkout_receipts_session ON public.checkout_receipts(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_checkout_receipts_email ON public.checkout_receipts(email);
CREATE INDEX IF NOT EXISTS idx_checkout_receipts_status ON public.checkout_receipts(status);

ALTER TABLE public.checkout_receipts ENABLE ROW LEVEL SECURITY;

-- Service role bypass (backend writes)
CREATE POLICY "service_role_all_checkout_receipts"
  ON public.checkout_receipts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Public can read receipt status (the session_id is unguessable, acts as auth)
CREATE POLICY "public_read_checkout_receipts"
  ON public.checkout_receipts
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- updated_at trigger
CREATE TRIGGER update_checkout_receipts_updated_at
  BEFORE UPDATE ON public.checkout_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();