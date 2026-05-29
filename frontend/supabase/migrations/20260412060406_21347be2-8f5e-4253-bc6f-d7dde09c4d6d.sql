
-- Dead Lead Campaigns
CREATE TABLE public.dead_lead_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES public.contractor_clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Reactivation Campaign',
  status TEXT NOT NULL DEFAULT 'active',
  total_contacts INTEGER NOT NULL DEFAULT 0,
  replied_count INTEGER NOT NULL DEFAULT 0,
  positive_count INTEGER NOT NULL DEFAULT 0,
  pause_reason TEXT,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  campaign_copy_variants JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dead_lead_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on dead_lead_campaigns" ON public.dead_lead_campaigns FOR ALL USING (true) WITH CHECK (true);

-- Dead Lead Contacts
CREATE TABLE public.dead_lead_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.dead_lead_campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  original_service TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  drip1_sent BOOLEAN NOT NULL DEFAULT false,
  drip2_sent BOOLEAN NOT NULL DEFAULT false,
  drip3_sent BOOLEAN NOT NULL DEFAULT false,
  replied_at TIMESTAMPTZ,
  reply_text TEXT,
  reply_sentiment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dead_lead_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on dead_lead_contacts" ON public.dead_lead_contacts FOR ALL USING (true) WITH CHECK (true);

-- Dead Lead Charges
CREATE TABLE public.dead_lead_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES public.contractor_clients(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.dead_lead_campaigns(id),
  contact_id UUID REFERENCES public.dead_lead_contacts(id),
  amount_cents INTEGER NOT NULL DEFAULT 5000,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'charged',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dead_lead_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on dead_lead_charges" ON public.dead_lead_charges FOR ALL USING (true) WITH CHECK (true);

-- Add billing columns to contractor_clients
ALTER TABLE public.contractor_clients
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT,
  ADD COLUMN IF NOT EXISTS dead_lead_billing_active BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_review_link TEXT,
  ADD COLUMN IF NOT EXISTS roi_token TEXT DEFAULT encode(gen_random_bytes(16), 'hex');
