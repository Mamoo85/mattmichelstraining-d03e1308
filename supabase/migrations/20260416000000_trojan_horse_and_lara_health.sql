-- Trojan Horse cross-sell tracking
-- Logs every FieldDesk upsell attempt sent to TechAlert clients
-- Used to prevent spam (14-day cooldown) and track conversion

CREATE TABLE IF NOT EXISTS public.trojan_horse_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hire_alert_client_id uuid REFERENCES public.hire_alert_clients(id),
  company_name text,
  email text,
  phone text,
  days_since_signup integer,
  sms_sent boolean DEFAULT false,
  email_sent boolean DEFAULT false,
  template_day integer,
  converted boolean DEFAULT false,
  converted_at timestamptz,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trojan_horse_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_trojan_horse_log"
  ON public.trojan_horse_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admin_select_trojan_horse_log"
  ON public.trojan_horse_log FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_trojan_horse_log_client_sent
  ON public.trojan_horse_log (hire_alert_client_id, sent_at DESC);

-- LARA health monitoring table
-- Tracks LARA/MiPLUS portal status over time for pattern detection
CREATE TABLE IF NOT EXISTS public.lara_health_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL CHECK (status IN ('ok', 'blocked', 'down', 'captcha', 'timeout', 'format_changed')),
  http_status integer,
  response_bytes integer,
  response_time_ms integer,
  error_message text,
  fallback_activated boolean DEFAULT false,
  fallback_sources text[],
  candidates_from_fallback integer DEFAULT 0,
  checked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lara_health_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_lara_health_log"
  ON public.lara_health_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admin_select_lara_health_log"
  ON public.lara_health_log FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_lara_health_log_checked_at
  ON public.lara_health_log (checked_at DESC);
