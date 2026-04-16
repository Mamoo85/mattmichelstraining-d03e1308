
-- Feature 1: Lightning Claim
ALTER TABLE public.contractor_leads
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_by uuid;

-- Feature 2: Fast-Track Interview
ALTER TABLE public.hire_alert_clients
  ADD COLUMN IF NOT EXISTS booking_link text;

-- Feature 3: Recovered Revenue Ledger
ALTER TABLE public.contractor_clients
  ADD COLUMN IF NOT EXISTS average_ticket_value integer NOT NULL DEFAULT 500;

-- Feature 4: En-Route Transparency
ALTER TABLE public.field_service_jobs
  ADD COLUMN IF NOT EXISTS customer_notified_at timestamptz;

-- Feature 6: Referral Multiplier
ALTER TABLE public.field_service_jobs
  ADD COLUMN IF NOT EXISTS referral_asked_at timestamptz;

-- Feature 5: Territory Defense — competitor_monitors
CREATE TABLE IF NOT EXISTS public.competitor_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  client_table text NOT NULL DEFAULT 'contractor_clients',
  competitor_name text NOT NULL,
  google_business_url text,
  license_number text,
  last_scanned_at timestamptz,
  last_review_count integer,
  last_avg_rating numeric(3,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.competitor_monitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on competitor_monitors"
  ON public.competitor_monitors FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Feature 5: Territory Defense — competitor_alerts
CREATE TABLE IF NOT EXISTS public.competitor_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id uuid REFERENCES public.competitor_monitors(id) ON DELETE CASCADE NOT NULL,
  alert_type text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.competitor_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on competitor_alerts"
  ON public.competitor_alerts FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_competitor_monitors_client ON public.competitor_monitors(client_id);
CREATE INDEX IF NOT EXISTS idx_competitor_alerts_monitor ON public.competitor_alerts(monitor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_leads_claimed ON public.contractor_leads(claimed_at) WHERE claimed_at IS NULL;
