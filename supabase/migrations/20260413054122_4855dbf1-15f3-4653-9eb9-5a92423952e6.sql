-- 1. Allow anonymous homeowner lead submissions
CREATE POLICY "anon_insert_leads" ON public.contractor_leads
FOR INSERT TO anon
WITH CHECK (true);

-- 2. Add missing columns to dead_lead_campaigns
ALTER TABLE public.dead_lead_campaigns
  ADD COLUMN IF NOT EXISTS trade text,
  ADD COLUMN IF NOT EXISTS is_free_trial boolean NOT NULL DEFAULT false;

-- 3. Add timestamp columns to dead_lead_contacts
ALTER TABLE public.dead_lead_contacts
  ADD COLUMN IF NOT EXISTS drip1_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS drip2_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS drip3_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS contractor_notified_at timestamptz;

-- 4. Add target_zip_codes to hire_alert_clients
ALTER TABLE public.hire_alert_clients
  ADD COLUMN IF NOT EXISTS target_zip_codes text[];