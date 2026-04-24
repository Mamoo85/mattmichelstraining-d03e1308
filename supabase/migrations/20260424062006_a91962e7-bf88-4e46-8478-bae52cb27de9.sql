
-- À la carte lead sales: track manual one-off lead offers Matt sends to candidate contractors
CREATE TABLE IF NOT EXISTS public.lead_alacarte_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.contractor_leads(id) ON DELETE CASCADE,
  candidate_prospect_ids text[] NOT NULL DEFAULT '{}',
  candidate_channels jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{prospect_id, channel:"sms"|"email", sent_at, recipient}]
  price_cents integer NOT NULL CHECK (price_cents >= 100),
  stripe_session_id text,
  stripe_payment_link text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','expired','cancelled','refunded')),
  claimed_by_prospect_id text,
  claimed_by_email text,
  claimed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alacarte_offers_lead ON public.lead_alacarte_offers(lead_id);
CREATE INDEX IF NOT EXISTS idx_alacarte_offers_status ON public.lead_alacarte_offers(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_alacarte_offers_session ON public.lead_alacarte_offers(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

ALTER TABLE public.lead_alacarte_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role manages alacarte offers"
  ON public.lead_alacarte_offers FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "admins read alacarte offers"
  ON public.lead_alacarte_offers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins insert alacarte offers"
  ON public.lead_alacarte_offers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER trg_alacarte_offers_updated_at
  BEFORE UPDATE ON public.lead_alacarte_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic claim: first paying contractor wins; locks the underlying contractor_lead too
CREATE OR REPLACE FUNCTION public.claim_alacarte_lead(
  _offer_id uuid,
  _stripe_session_id text,
  _claimer_email text,
  _claimer_prospect_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _offer record;
  _result jsonb;
BEGIN
  -- Lock the offer row
  SELECT * INTO _offer
  FROM public.lead_alacarte_offers
  WHERE id = _offer_id
  FOR UPDATE;

  IF _offer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'offer_not_found');
  END IF;

  IF _offer.status = 'claimed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed', 'claimed_by', _offer.claimed_by_email);
  END IF;

  IF _offer.status NOT IN ('open') OR _offer.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'offer_unavailable', 'status', _offer.status);
  END IF;

  -- Mark the offer claimed
  UPDATE public.lead_alacarte_offers
  SET status = 'claimed',
      claimed_by_email = _claimer_email,
      claimed_by_prospect_id = _claimer_prospect_id,
      claimed_at = now(),
      stripe_session_id = COALESCE(_stripe_session_id, stripe_session_id),
      updated_at = now()
  WHERE id = _offer_id;

  -- Lock the underlying contractor_leads row so it can't be sold via PPL too
  UPDATE public.contractor_leads
  SET claimed_at = now(),
      paid_by_contractor_id = _claimer_email,
      payment_amount_cents = _offer.price_cents,
      payment_session_id = _stripe_session_id,
      status = 'claimed',
      checkout_locked_by = _claimer_email,
      lock_expires_at = now() + interval '24 hours'
  WHERE id = _offer.lead_id
    AND claimed_at IS NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'offer_id', _offer.id,
    'lead_id', _offer.lead_id,
    'price_cents', _offer.price_cents
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_alacarte_lead(uuid, text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_alacarte_lead(uuid, text, text, text) TO service_role;
