
-- postcard_send_log: tracks Lob API sends
CREATE TABLE public.postcard_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid,
  campaign_id uuid REFERENCES public.postcard_campaigns(id),
  lob_id text,
  address_line1 text,
  city text,
  state text,
  zip text,
  business_name text,
  sent_at timestamptz DEFAULT now(),
  status text DEFAULT 'sent',
  delivery_status text,
  cost_cents integer DEFAULT 80
);
ALTER TABLE public.postcard_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on postcard_send_log" ON public.postcard_send_log FOR ALL USING (true) WITH CHECK (true);

-- techalert_referrals: tracks referral program
CREATE TABLE public.techalert_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_client_id uuid REFERENCES public.hire_alert_clients(id),
  referrer_email text NOT NULL,
  referred_email text NOT NULL,
  referral_code text NOT NULL,
  status text DEFAULT 'pending',
  credited_at timestamptz,
  credit_amount_cents integer DEFAULT 5000,
  stripe_coupon_id text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.techalert_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on techalert_referrals" ON public.techalert_referrals FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_techalert_referrals_code ON public.techalert_referrals(referral_code);

-- Add referral_code column to hire_alert_clients
ALTER TABLE public.hire_alert_clients ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
