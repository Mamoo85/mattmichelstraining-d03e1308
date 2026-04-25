-- Rate-limiting table for marketplace-buyer-receipts.
-- Tracks receipt access attempts per IP so the function can enforce
-- a max of 10 lookups/hour per IP, blocking enumeration attacks.
CREATE TABLE IF NOT EXISTS public.marketplace_receipt_access_log (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  ip          text        NOT NULL,
  buyer_email text        NOT NULL,
  accessed_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mral_ip_time
  ON public.marketplace_receipt_access_log (ip, accessed_at);

ALTER TABLE public.marketplace_receipt_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_bypass" ON public.marketplace_receipt_access_log
  TO service_role USING (true) WITH CHECK (true);
