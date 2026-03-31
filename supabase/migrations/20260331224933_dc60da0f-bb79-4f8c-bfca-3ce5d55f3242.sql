-- Session Referral Rewards for in-person training
CREATE TABLE public.session_referral_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID NOT NULL,
  referred_friend_email TEXT NOT NULL,
  session_type TEXT NOT NULL DEFAULT '60_min',
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  credited_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ
);

ALTER TABLE public.session_referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_session_referrals" ON public.session_referral_rewards
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "admin_access_session_referrals" ON public.session_referral_rewards
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "own_referral_rewards" ON public.session_referral_rewards
  FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid());

-- B2B Referral Partners
CREATE TABLE public.b2b_referral_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  referral_code TEXT NOT NULL UNIQUE,
  commission_type TEXT NOT NULL DEFAULT 'flat',
  commission_value NUMERIC NOT NULL DEFAULT 50,
  total_earned NUMERIC NOT NULL DEFAULT 0,
  payout_threshold NUMERIC NOT NULL DEFAULT 50,
  payout_handle TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.b2b_referral_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_b2b_partners" ON public.b2b_referral_partners
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "admin_access_b2b_partners" ON public.b2b_referral_partners
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "anon_insert_b2b_partners" ON public.b2b_referral_partners
  FOR INSERT TO anon
  WITH CHECK (true);

-- B2B Referral Conversions
CREATE TABLE public.b2b_referral_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.b2b_referral_partners(id) ON DELETE CASCADE,
  client_email TEXT NOT NULL,
  service_type TEXT NOT NULL,
  stripe_session_id TEXT,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

ALTER TABLE public.b2b_referral_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_b2b_conversions" ON public.b2b_referral_conversions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "admin_access_b2b_conversions" ON public.b2b_referral_conversions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));