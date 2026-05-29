
-- Referral codes table
CREATE TABLE public.referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  credits_earned INTEGER NOT NULL DEFAULT 0,
  credits_redeemed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral code"
  ON public.referral_codes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own referral code"
  ON public.referral_codes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all referral codes"
  ON public.referral_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role for webhook updates
CREATE POLICY "Service role manages referral codes"
  ON public.referral_codes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Referral conversions table
CREATE TABLE public.referral_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID NOT NULL,
  referred_user_id UUID NOT NULL,
  referral_code TEXT NOT NULL,
  subscription_tier TEXT,
  credited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral conversions"
  ON public.referral_conversions FOR SELECT TO authenticated
  USING (auth.uid() = referrer_user_id);

CREATE POLICY "Admins can manage all conversions"
  ON public.referral_conversions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages conversions"
  ON public.referral_conversions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Function to generate a referral code from a profile
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_name TEXT;
  ref_code TEXT;
  suffix INT := 0;
BEGIN
  -- Build code from athlete_name or full_name
  base_name := UPPER(REGEXP_REPLACE(
    COALESCE(NULLIF(NEW.athlete_name, ''), NULLIF(NEW.full_name, ''), 'MATT'),
    '[^A-Za-z0-9]', '', 'g'
  ));
  base_name := LEFT(base_name, 8);
  ref_code := base_name || '-M2';

  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.referral_codes WHERE code = ref_code) LOOP
    suffix := suffix + 1;
    ref_code := base_name || suffix || '-M2';
  END LOOP;

  INSERT INTO public.referral_codes (user_id, code)
  VALUES (NEW.user_id, ref_code)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger: auto-generate referral code when profile is created
CREATE TRIGGER generate_referral_code_on_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();
