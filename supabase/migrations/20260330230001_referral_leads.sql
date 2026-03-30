CREATE TABLE IF NOT EXISTS public.referral_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_name TEXT NOT NULL,
  referrer_email TEXT NOT NULL,
  friend_name TEXT NOT NULL,
  friend_business TEXT NOT NULL,
  friend_email TEXT NOT NULL,
  service TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  credited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.referral_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages referral_leads"
  ON public.referral_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
