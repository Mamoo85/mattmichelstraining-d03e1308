
CREATE TABLE public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  original_amount numeric NOT NULL,
  remaining_balance numeric NOT NULL,
  purchaser_id uuid NOT NULL,
  recipient_email text,
  stripe_session_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_by uuid,
  redeemed_at timestamptz
);

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

-- Purchasers can view their own gift cards
CREATE POLICY "Users can view own purchased gift cards"
  ON public.gift_cards FOR SELECT
  TO authenticated
  USING (auth.uid() = purchaser_id);

-- Recipients can view gift cards redeemed by them
CREATE POLICY "Users can view redeemed gift cards"
  ON public.gift_cards FOR SELECT
  TO authenticated
  USING (auth.uid() = redeemed_by);

-- Service role can manage all
CREATE POLICY "Service role can manage gift cards"
  ON public.gift_cards FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can manage all gift cards
CREATE POLICY "Admins can manage gift cards"
  ON public.gift_cards FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Anyone authenticated can look up a gift card by code (for redemption)
CREATE POLICY "Users can lookup gift cards by code"
  ON public.gift_cards FOR SELECT
  TO authenticated
  USING (is_active = true);
