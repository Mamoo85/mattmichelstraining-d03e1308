-- ============================================================
-- error_logs: unified silent-failure tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL,               -- 'twilio' | 'resend' | 'stripe' | 'cron' | 'edge_function'
  function_name TEXT,                 -- e.g. 'contractor-lead-notify'
  severity TEXT NOT NULL DEFAULT 'error', -- 'warn' | 'error' | 'critical'
  recipient TEXT,                     -- email or E.164 phone (nullable)
  payload JSONB,                      -- the message we tried to send
  error_message TEXT,
  http_status INT,
  alerted_admin BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_source ON public.error_logs(source);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- service_role bypass (edge functions write)
CREATE POLICY "service_role_all_error_logs"
  ON public.error_logs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- admins can read
CREATE POLICY "admins_read_error_logs"
  ON public.error_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- contractor_leads: AI summary cache
-- ============================================================
ALTER TABLE public.contractor_leads
  ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- ============================================================
-- dead_lead_contacts: 3-step sequence + reply tracking
-- ============================================================
ALTER TABLE public.dead_lead_contacts
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS requires_human BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS drip_step INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_dead_lead_contacts_drip_step ON public.dead_lead_contacts(drip_step);
CREATE INDEX IF NOT EXISTS idx_dead_lead_contacts_requires_human ON public.dead_lead_contacts(requires_human) WHERE requires_human = true;