-- Radar Referral codes (TR-15) — separate from existing fitness referral_codes
CREATE TABLE IF NOT EXISTS public.radar_referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  owner_type TEXT NOT NULL,
  owner_id UUID NOT NULL,
  owner_email TEXT,
  uses INTEGER NOT NULL DEFAULT 0,
  reward_type TEXT NOT NULL DEFAULT 'free_month',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.radar_referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role all radar_referral_codes" ON public.radar_referral_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_radar_referral_codes_owner ON public.radar_referral_codes(owner_type, owner_id);

CREATE TABLE IF NOT EXISTS public.signal_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  signal_id UUID NOT NULL,
  signal_table TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('up','down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, signal_id, signal_table)
);
ALTER TABLE public.signal_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role all signal_feedback" ON public.signal_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.companies_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, company_name)
);
ALTER TABLE public.companies_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role all companies_watchlist" ON public.companies_watchlist FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  client_type TEXT NOT NULL DEFAULT 'growth_radar',
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  counties TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role all saved_searches" ON public.saved_searches FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.lead_credit_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL,
  pack_size INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  credits_remaining INTEGER NOT NULL,
  stripe_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ
);
ALTER TABLE public.lead_credit_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role all lead_credit_packs" ON public.lead_credit_packs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_lead_credit_packs_contractor ON public.lead_credit_packs(contractor_id, status);

CREATE TABLE IF NOT EXISTS public.contractor_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_contractor_id UUID NOT NULL,
  referral_code TEXT NOT NULL,
  referred_email TEXT,
  referred_contractor_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  credit_amount_cents INTEGER NOT NULL DEFAULT 5000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ
);
ALTER TABLE public.contractor_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role all contractor_referrals" ON public.contractor_referrals FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.hire_REDACTED
  ADD COLUMN IF NOT EXISTS claim_lock_token TEXT;
CREATE INDEX IF NOT EXISTS idx_haccc_claim_token ON public.hire_REDACTED(claim_lock_token) WHERE claim_lock_token IS NOT NULL;