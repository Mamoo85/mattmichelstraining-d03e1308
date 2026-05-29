-- ═══════════════════════════════════════════════════════════════
-- 10 New Automated Products Migration
-- ═══════════════════════════════════════════════════════════════

-- 1. Google Review Monitor clients
CREATE TABLE IF NOT EXISTS review_monitor_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  google_place_id TEXT,
  last_seen_review_id TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE review_monitor_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON review_monitor_clients FOR ALL USING (true);

-- 2. Weekly SMS Blast clients + contacts
CREATE TABLE IF NOT EXISTS sms_blast_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  business_type TEXT,
  city TEXT,
  state TEXT DEFAULT 'MI',
  phone TEXT,
  active BOOLEAN DEFAULT false,
  contact_count INTEGER DEFAULT 0,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_blast_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sms_blast_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON sms_blast_clients FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS sms_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES sms_blast_clients(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  opt_out BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sms_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON sms_contacts FOR ALL USING (true);

-- 3. No-Show Re-Booker clients + events
CREATE TABLE IF NOT EXISTS noshow_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  booking_url TEXT,
  custom_message TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE noshow_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON noshow_clients FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS noshow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES noshow_clients(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  send_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE noshow_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON noshow_events FOR ALL USING (true);

-- 4. Estimate Follow-Up Drip clients + sequences
CREATE TABLE IF NOT EXISTS estimate_drip_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  business_type TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE estimate_drip_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON estimate_drip_clients FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS estimate_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES estimate_drip_clients(id) ON DELETE CASCADE,
  prospect_name TEXT,
  prospect_phone TEXT,
  job_type TEXT,
  estimate_amount NUMERIC,
  city TEXT,
  current_step INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  stopped BOOLEAN DEFAULT false,
  next_send_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE estimate_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON estimate_sequences FOR ALL USING (true);

-- 5. Invoice Chaser clients + invoices
CREATE TABLE IF NOT EXISTS invoice_chaser_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE invoice_chaser_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON invoice_chaser_clients FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS tracked_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES invoice_chaser_clients(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  invoice_amount NUMERIC,
  due_date DATE,
  paid BOOLEAN DEFAULT false,
  reminders_sent INTEGER DEFAULT 0,
  next_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE tracked_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON tracked_invoices FOR ALL USING (true);

-- 6. After-Job Follow-Up Drip
CREATE TABLE IF NOT EXISTS afterjob_drip_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  business_type TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE afterjob_drip_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON afterjob_drip_clients FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS afterjob_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES afterjob_drip_clients(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_phone TEXT,
  job_type TEXT,
  completed_at TIMESTAMPTZ,
  current_step INTEGER DEFAULT 0,
  stopped BOOLEAN DEFAULT false,
  next_send_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE afterjob_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON afterjob_sequences FOR ALL USING (true);

-- 7. Seasonal Promo Blaster
CREATE TABLE IF NOT EXISTS promo_blaster_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  business_type TEXT,
  city TEXT,
  state TEXT DEFAULT 'MI',
  phone TEXT,
  active BOOLEAN DEFAULT false,
  contact_count INTEGER DEFAULT 0,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_promo_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE promo_blaster_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON promo_blaster_clients FOR ALL USING (true);

-- 8. Automated Referral Program
CREATE TABLE IF NOT EXISTS referral_program_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  business_type TEXT,
  phone TEXT,
  reward_amount INTEGER DEFAULT 25,
  reward_type TEXT DEFAULT 'discount',
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE referral_program_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON referral_program_clients FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES referral_program_clients(id) ON DELETE CASCADE,
  referrer_name TEXT,
  referrer_phone TEXT,
  referral_code TEXT UNIQUE,
  referred_name TEXT,
  referred_phone TEXT,
  converted BOOLEAN DEFAULT false,
  reward_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON referrals FOR ALL USING (true);

-- 9. Slow Day Push SMS
CREATE TABLE IF NOT EXISTS slow_day_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  business_type TEXT,
  phone TEXT,
  trigger_keyword TEXT DEFAULT 'SLOW',
  promo_offer TEXT,
  active BOOLEAN DEFAULT false,
  contact_count INTEGER DEFAULT 0,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  last_blast_at TIMESTAMPTZ,
  twilio_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE slow_day_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON slow_day_clients FOR ALL USING (true);

-- 10. New Homeowner Campaign
CREATE TABLE IF NOT EXISTS homeowner_campaign_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  business_type TEXT,
  phone TEXT,
  target_zip TEXT,
  target_radius_miles INTEGER DEFAULT 10,
  offer_headline TEXT,
  offer_detail TEXT,
  active BOOLEAN DEFAULT false,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  leads_sent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE homeowner_campaign_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON homeowner_campaign_clients FOR ALL USING (true);
