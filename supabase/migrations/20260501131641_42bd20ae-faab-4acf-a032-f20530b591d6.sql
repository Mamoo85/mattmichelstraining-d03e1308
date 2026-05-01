-- Client health scores (weekly snapshot per client)
CREATE TABLE IF NOT EXISTS public.client_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  product TEXT NOT NULL,
  score INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  status TEXT NOT NULL CHECK (status IN ('green','yellow','red')),
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  matt_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_health_email ON public.client_health_scores(client_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_health_status ON public.client_health_scores(status, created_at DESC) WHERE status = 'red';
ALTER TABLE public.client_health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_health" ON public.client_health_scores FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Upsell opportunities
CREATE TABLE IF NOT EXISTS public.upsell_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  current_product TEXT NOT NULL,
  suggested_addon TEXT NOT NULL,
  trigger_reason TEXT NOT NULL,
  signal_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  pitched_at TIMESTAMPTZ,
  pitched_by UUID,
  outcome TEXT CHECK (outcome IN ('pending','accepted','declined','no_response')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_email, suggested_addon)
);
CREATE INDEX IF NOT EXISTS idx_upsell_unpitched ON public.upsell_opportunities(created_at DESC) WHERE pitched_at IS NULL;
ALTER TABLE public.upsell_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_upsell" ON public.upsell_opportunities FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anniversary notices
CREATE TABLE IF NOT EXISTS public.anniversary_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  product TEXT NOT NULL,
  signup_date DATE NOT NULL,
  notice_year INT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recap_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (client_email, product, notice_year)
);
ALTER TABLE public.anniversary_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_anniversary" ON public.anniversary_notices FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Referral partners v2 — add tier columns if table exists; create if it doesn't
CREATE TABLE IF NOT EXISTS public.referral_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  payout_handle TEXT,
  code TEXT NOT NULL UNIQUE,
  total_referrals INT NOT NULL DEFAULT 0,
  paid_referrals INT NOT NULL DEFAULT 0,
  current_tier TEXT NOT NULL DEFAULT 'bronze' CHECK (current_tier IN ('bronze','silver','gold','platinum')),
  lifetime_discount_pct INT NOT NULL DEFAULT 0,
  free_months_earned INT NOT NULL DEFAULT 0,
  cash_earned_cents INT NOT NULL DEFAULT 0,
  show_on_leaderboard BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns idempotently if table pre-existed
ALTER TABLE public.referral_partners ADD COLUMN IF NOT EXISTS current_tier TEXT NOT NULL DEFAULT 'bronze';
ALTER TABLE public.referral_partners ADD COLUMN IF NOT EXISTS lifetime_discount_pct INT NOT NULL DEFAULT 0;
ALTER TABLE public.referral_partners ADD COLUMN IF NOT EXISTS free_months_earned INT NOT NULL DEFAULT 0;
ALTER TABLE public.referral_partners ADD COLUMN IF NOT EXISTS cash_earned_cents INT NOT NULL DEFAULT 0;
ALTER TABLE public.referral_partners ADD COLUMN IF NOT EXISTS show_on_leaderboard BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_referral_partners" ON public.referral_partners;
CREATE POLICY "service_role_all_referral_partners" ON public.referral_partners FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "public_leaderboard_view" ON public.referral_partners;
CREATE POLICY "public_leaderboard_view" ON public.referral_partners FOR SELECT TO anon, authenticated USING (show_on_leaderboard = true);