-- ============================================================
-- Marketplace TTL + Anon Merge + Refund/Reversal + Rate Limiting
-- ============================================================

-- 1. Lock columns: TTL, revocation, payment intent
ALTER TABLE public.marketplace_lead_locks
  ADD COLUMN IF NOT EXISTS access_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoke_reason text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_charge_id text,
  ADD COLUMN IF NOT EXISTS anon_session_id text;

CREATE INDEX IF NOT EXISTS idx_mll_access_expires
  ON public.marketplace_lead_locks (access_expires_at)
  WHERE status = 'sold' AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mll_payment_intent
  ON public.marketplace_lead_locks (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mll_charge
  ON public.marketplace_lead_locks (stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;

-- 2. Anon merge support on buyer_views
ALTER TABLE public.marketplace_buyer_views
  ADD COLUMN IF NOT EXISTS anon_session_id text,
  ADD COLUMN IF NOT EXISTS buyer_email text,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_mbv_anon ON public.marketplace_buyer_views (anon_session_id) WHERE anon_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mbv_buyer ON public.marketplace_buyer_views (buyer_email) WHERE buyer_email IS NOT NULL;

-- 3. Share-token rate-limit bookkeeping
ALTER TABLE public.marketplace_lead_shares
  ADD COLUMN IF NOT EXISTS redeem_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_redeem_ip_hash text,
  ADD COLUMN IF NOT EXISTS last_redeem_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- 4. Per-IP rate-limit table (rolling window)
CREATE TABLE IF NOT EXISTS public.marketplace_redeem_rate_limits (
  ip_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_redeem_rate_limits ENABLE ROW LEVEL SECURITY;

-- 5. Redeem audit log
CREATE TABLE IF NOT EXISTS public.marketplace_share_redeem_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid,
  token_hash text NOT NULL,
  ip_hash text,
  user_agent text,
  outcome text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msrl_created ON public.marketplace_share_redeem_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msrl_token ON public.marketplace_share_redeem_log (token_hash);
CREATE INDEX IF NOT EXISTS idx_msrl_ip ON public.marketplace_share_redeem_log (ip_hash);
ALTER TABLE public.marketplace_share_redeem_log ENABLE ROW LEVEL SECURITY;

-- 6. Settings table for configurable TTL (default 30 days)
CREATE TABLE IF NOT EXISTS public.marketplace_settings (
  key text PRIMARY KEY,
  value_int integer,
  value_text text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.marketplace_settings (key, value_int)
VALUES ('access_ttl_days', 30)
ON CONFLICT (key) DO NOTHING;

-- 7. Helper: read TTL
CREATE OR REPLACE FUNCTION public.get_marketplace_access_ttl_days()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value_int FROM public.marketplace_settings WHERE key = 'access_ttl_days'), 30);
$$;

-- 8. Merge anonymous views into a confirmed buyer
CREATE OR REPLACE FUNCTION public.merge_anon_buyer_views(p_anon_session_id text, p_buyer_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_anon_session_id IS NULL OR p_buyer_email IS NULL THEN
    RETURN 0;
  END IF;
  UPDATE public.marketplace_buyer_views
     SET buyer_email = lower(p_buyer_email),
         merged_at = now()
   WHERE anon_session_id = p_anon_session_id
     AND (buyer_email IS NULL OR buyer_email <> lower(p_buyer_email));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 9. Revoke a sold dossier (refund / chargeback / manual)
CREATE OR REPLACE FUNCTION public.revoke_marketplace_access(
  p_lead_id uuid,
  p_product text,
  p_reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer := 0;
BEGIN
  UPDATE public.marketplace_lead_locks
     SET status = 'refunded',
         revoked_at = now(),
         revoke_reason = COALESCE(p_reason, 'manual'),
         access_expires_at = now()
   WHERE lead_id = p_lead_id
     AND product = p_product
     AND status = 'sold'
     AND revoked_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 10. Revoke by stripe charge / payment_intent (used by webhook)
CREATE OR REPLACE FUNCTION public.revoke_marketplace_access_by_stripe(
  p_payment_intent_id text,
  p_charge_id text,
  p_reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer := 0;
BEGIN
  UPDATE public.marketplace_lead_locks
     SET status = 'refunded',
         revoked_at = now(),
         revoke_reason = COALESCE(p_reason, 'stripe_reversal'),
         access_expires_at = now(),
         stripe_charge_id = COALESCE(stripe_charge_id, p_charge_id)
   WHERE status = 'sold'
     AND revoked_at IS NULL
     AND (
       (p_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = p_payment_intent_id)
       OR (p_charge_id IS NOT NULL AND stripe_charge_id = p_charge_id)
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 11. Mark expired access (cron-callable)
CREATE OR REPLACE FUNCTION public.expire_marketplace_access()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer := 0;
BEGIN
  UPDATE public.marketplace_lead_locks
     SET status = 'expired'
   WHERE status = 'sold'
     AND revoked_at IS NULL
     AND access_expires_at IS NOT NULL
     AND access_expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 12. Admin read policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role') THEN
    EXECUTE 'DROP POLICY IF EXISTS admin_read ON public.marketplace_share_redeem_log';
    EXECUTE 'CREATE POLICY admin_read ON public.marketplace_share_redeem_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role))';

    EXECUTE 'DROP POLICY IF EXISTS admin_read ON public.marketplace_redeem_rate_limits';
    EXECUTE 'CREATE POLICY admin_read ON public.marketplace_redeem_rate_limits FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role))';

    EXECUTE 'DROP POLICY IF EXISTS admin_read ON public.marketplace_settings';
    EXECUTE 'CREATE POLICY admin_read ON public.marketplace_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role))';
    EXECUTE 'DROP POLICY IF EXISTS admin_write ON public.marketplace_settings';
    EXECUTE 'CREATE POLICY admin_write ON public.marketplace_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''admin''::app_role))';
  END IF;
END $$;

-- 13. Service-role bypass on new tables
DROP POLICY IF EXISTS service_all ON public.marketplace_redeem_rate_limits;
CREATE POLICY service_all ON public.marketplace_redeem_rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_all ON public.marketplace_share_redeem_log;
CREATE POLICY service_all ON public.marketplace_share_redeem_log FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_all ON public.marketplace_settings;
CREATE POLICY service_all ON public.marketplace_settings FOR ALL TO service_role USING (true) WITH CHECK (true);