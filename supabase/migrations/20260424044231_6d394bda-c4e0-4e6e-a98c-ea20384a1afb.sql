-- ============================================================================
-- DEFENSE PROTOCOL HARDENING — race-safety + RLS tightening
-- ============================================================================

-- 1) Atomic soft-lock RPC for marketplace leads
-- Returns 'acquired' | 'refreshed' | 'already_sold' | 'locked_by_other'
CREATE OR REPLACE FUNCTION public.claim_lead_soft_lock(
  _lead_id uuid,
  _product text,
  _buyer_email text,
  _ttl_minutes int DEFAULT 10
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing record;
  v_expires timestamptz := now() + make_interval(mins => _ttl_minutes);
BEGIN
  -- Row lock on the (lead_id, product) pair if it exists
  SELECT id, status, expires_at, buyer_email
    INTO v_existing
  FROM public.marketplace_lead_locks
  WHERE lead_id = _lead_id AND product = _product
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'sold' THEN
      RETURN 'already_sold';
    END IF;
    -- Active pending lock held by someone else and not expired → refuse
    IF v_existing.status IN ('pending','soft_locked')
       AND v_existing.expires_at IS NOT NULL
       AND v_existing.expires_at > now()
       AND v_existing.buyer_email IS DISTINCT FROM lower(_buyer_email)
    THEN
      RETURN 'locked_by_other';
    END IF;
    -- Refresh / take over expired or own lock
    UPDATE public.marketplace_lead_locks
       SET status = 'pending',
           buyer_email = lower(_buyer_email),
           expires_at = v_expires,
           locked_at = now()
     WHERE id = v_existing.id;
    RETURN 'refreshed';
  END IF;

  -- No row yet — insert new soft lock
  INSERT INTO public.marketplace_lead_locks (lead_id, product, buyer_email, status, expires_at, locked_at)
  VALUES (_lead_id, _product, lower(_buyer_email), 'pending', v_expires, now());
  RETURN 'acquired';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_lead_soft_lock(uuid, text, text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_lead_soft_lock(uuid, text, text, int) TO service_role;

-- 2) Unique index preventing duplicate drip-step sends per (campaign, contact)
-- Using drip_step on dead_lead_contacts table; the existing schema treats step
-- as a state machine on the contact row itself, so a partial unique index keyed
-- on (id, drip_step) is not meaningful. Instead protect the existing single-row
-- update path by enforcing that a contact cannot regress to a step it has
-- already sent. We use a CHECK trigger because drip_step is not a separate row.
CREATE OR REPLACE FUNCTION public.dead_lead_drip_step_monotonic()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Allow setting to 9 (terminal/halt) at any time; otherwise step must move forward
  IF NEW.drip_step IS NOT NULL
     AND OLD.drip_step IS NOT NULL
     AND NEW.drip_step <> 9
     AND NEW.drip_step < OLD.drip_step THEN
    RAISE EXCEPTION 'dead_lead_contacts.drip_step cannot regress (% -> %)', OLD.drip_step, NEW.drip_step
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dead_lead_drip_step_monotonic ON public.dead_lead_contacts;
CREATE TRIGGER trg_dead_lead_drip_step_monotonic
BEFORE UPDATE OF drip_step ON public.dead_lead_contacts
FOR EACH ROW
EXECUTE FUNCTION public.dead_lead_drip_step_monotonic();

-- 3) Tighten marketplace_buyer_watches RLS — service_role only for writes
DROP POLICY IF EXISTS "Anyone can read marketplace_buyer_watches" ON public.marketplace_buyer_watches;
DROP POLICY IF EXISTS "Anyone can insert marketplace_buyer_watches" ON public.marketplace_buyer_watches;
DROP POLICY IF EXISTS "Anyone can update marketplace_buyer_watches" ON public.marketplace_buyer_watches;
DROP POLICY IF EXISTS "Anyone can delete marketplace_buyer_watches" ON public.marketplace_buyer_watches;

CREATE POLICY "service_role full access to buyer_watches"
ON public.marketplace_buyer_watches
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admin can read marketplace_buyer_watches"
ON public.marketplace_buyer_watches
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) Buyer session tokens (signed-email proof, used by marketplace endpoints)
CREATE TABLE IF NOT EXISTS public.buyer_session_tokens (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  user_agent text,
  ip_hash text
);
CREATE INDEX IF NOT EXISTS idx_buyer_session_tokens_email ON public.buyer_session_tokens(buyer_email);
CREATE INDEX IF NOT EXISTS idx_buyer_session_tokens_expires ON public.buyer_session_tokens(expires_at);
ALTER TABLE public.buyer_session_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role full access to buyer_session_tokens" ON public.buyer_session_tokens;
CREATE POLICY "service_role full access to buyer_session_tokens"
ON public.buyer_session_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admin can read buyer_session_tokens" ON public.buyer_session_tokens;
CREATE POLICY "Admin can read buyer_session_tokens"
ON public.buyer_session_tokens FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));