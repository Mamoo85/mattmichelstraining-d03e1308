CREATE TABLE IF NOT EXISTS public.dwa_contractor_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_email text NOT NULL,
  referrer_business_name text,
  referrer_phone text,
  referred_email text NOT NULL,
  referred_business_name text,
  referred_phone text,
  product_interest text NOT NULL DEFAULT 'any',
  referral_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  credit_amount_cents integer NOT NULL DEFAULT 5000,
  stripe_coupon_id text,
  signed_up_at timestamptz,
  paid_at timestamptz,
  credited_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dwa_referrals_code ON public.dwa_contractor_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_dwa_referrals_referrer ON public.dwa_contractor_referrals(referrer_email);
CREATE INDEX IF NOT EXISTS idx_dwa_referrals_status ON public.dwa_contractor_referrals(status);

ALTER TABLE public.dwa_contractor_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on dwa_contractor_referrals"
  ON public.dwa_contractor_referrals FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view all dwa referrals"
  ON public.dwa_contractor_referrals FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_dwa_contractor_referrals_updated_at
  BEFORE UPDATE ON public.dwa_contractor_referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();