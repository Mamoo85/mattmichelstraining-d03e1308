-- SMS full-body storage + idempotent resend infrastructure
-- Adds body_full + body_hash to system_comms_log so we can resend byte-identical
-- messages later. Creates sms_idempotency_keys for safe retries / dedup.

-- 1. Extend system_comms_log (additive only — body_preview stays for back-compat)
ALTER TABLE public.system_comms_log
  ADD COLUMN IF NOT EXISTS body_full text,
  ADD COLUMN IF NOT EXISTS body_hash text;

-- Fast lookup for dedup checks: "did we send this exact body to this recipient recently?"
CREATE INDEX IF NOT EXISTS idx_system_comms_log_recipient_hash_created
  ON public.system_comms_log (recipient, body_hash, created_at DESC)
  WHERE body_hash IS NOT NULL;

-- 2. Idempotency table — stores response payload keyed by client-supplied UUID
--    Allows retried HTTP calls to get the cached answer instead of double-sending.
CREATE TABLE IF NOT EXISTS public.sms_idempotency_keys (
  key text PRIMARY KEY,
  recipient text,
  body_hash text,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_sms_idempotency_keys_expires
  ON public.sms_idempotency_keys (expires_at);

ALTER TABLE public.sms_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Admins can SELECT (for the resend modal to check status)
DROP POLICY IF EXISTS "Admins read sms_idempotency_keys" ON public.sms_idempotency_keys;
CREATE POLICY "Admins read sms_idempotency_keys"
  ON public.sms_idempotency_keys
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'agency_admin'::app_role));

-- Service role bypass for INSERT/UPDATE (edge functions write)
DROP POLICY IF EXISTS "Service role full access sms_idempotency_keys" ON public.sms_idempotency_keys;
CREATE POLICY "Service role full access sms_idempotency_keys"
  ON public.sms_idempotency_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Auto-cleanup function — purge keys older than 24h. Called opportunistically
--    by dwa-resend-sms; safe to call repeatedly.
CREATE OR REPLACE FUNCTION public.purge_expired_idempotency_keys()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM public.sms_idempotency_keys WHERE expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_expired_idempotency_keys() TO service_role;