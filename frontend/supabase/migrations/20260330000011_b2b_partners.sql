CREATE TABLE IF NOT EXISTS b2b_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  referral_code TEXT NOT NULL UNIQUE,
  total_referrals INT NOT NULL DEFAULT 0,
  pending_payout NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS b2b_partner_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_email TEXT NOT NULL,
  referred_business_name TEXT,
  referred_email TEXT,
  service TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  payout_amount NUMERIC(10,2) NOT NULL DEFAULT 100,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE b2b_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages b2b_partners"
  ON b2b_partners FOR ALL TO service_role USING (true) WITH CHECK (true);
ALTER TABLE b2b_partner_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages b2b_partner_referrals"
  ON b2b_partner_referrals FOR ALL TO service_role USING (true) WITH CHECK (true);
