-- Dark Web Credential Monitor
-- Tables: dark_web_monitor_clients, dark_web_monitor_findings
-- RLS: users see own rows, service role sees all

CREATE TABLE IF NOT EXISTS public.dark_web_monitor_clients (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email         text NOT NULL,
  customer_name          text,
  company_name           text,
  monitored_domain       text NOT NULL,
  plan_type              text NOT NULL DEFAULT 'direct',
  domains_allowed        int  NOT NULL DEFAULT 1,
  stripe_subscription_id text,
  subscription_status    text NOT NULL DEFAULT 'active',
  last_scan_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dark_web_monitor_findings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          uuid NOT NULL REFERENCES public.dark_web_monitor_clients(id) ON DELETE CASCADE,
  domain             text NOT NULL,
  breach_name        text NOT NULL,
  breach_title       text,
  breach_date        text,
  data_types_exposed text,
  pwn_count          bigint,
  severity           text NOT NULL DEFAULT 'medium',
  is_new             boolean NOT NULL DEFAULT true,
  ai_remediation     text,
  first_seen_at      timestamptz NOT NULL DEFAULT now(),
  reported_at        timestamptz,
  UNIQUE (client_id, breach_name)
);

-- RLS
ALTER TABLE public.dark_web_monitor_clients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dark_web_monitor_findings ENABLE ROW LEVEL SECURITY;

-- Clients: users see their own rows
CREATE POLICY "clients_select_own"
  ON public.dark_web_monitor_clients
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "clients_insert_own"
  ON public.dark_web_monitor_clients
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "clients_update_own"
  ON public.dark_web_monitor_clients
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role bypass (checked via current_setting)
CREATE POLICY "clients_service_all"
  ON public.dark_web_monitor_clients
  FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- Findings: users see findings for their own clients
CREATE POLICY "findings_select_own"
  ON public.dark_web_monitor_findings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dark_web_monitor_clients c
      WHERE c.id = client_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "findings_service_all"
  ON public.dark_web_monitor_findings
  FOR ALL
  USING (current_setting('role', true) = 'service_role');
