CREATE TABLE public.delivery_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  error_message TEXT,
  customer_email TEXT,
  order_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.delivery_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on delivery_failures"
  ON public.delivery_failures
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);