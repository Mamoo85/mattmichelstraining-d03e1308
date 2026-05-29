
CREATE TABLE IF NOT EXISTS public.web_design_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_email TEXT NOT NULL,
  referrer_name TEXT,
  referred_email TEXT NOT NULL,
  referred_business_name TEXT,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payout_amount_cents INTEGER NOT NULL DEFAULT 5000,
  payout_method TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  stripe_session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.web_design_referrals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'web_design_referrals' AND policyname = 'Service role full access on web_design_referrals') THEN
    CREATE POLICY "Service role full access on web_design_referrals"
      ON public.web_design_referrals FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
