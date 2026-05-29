
CREATE TABLE public.retention_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_type text NOT NULL DEFAULT 'velocity_drop',
  avg_weekly_logs numeric NOT NULL DEFAULT 0,
  days_since_last_log integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.retention_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read retention_alerts"
  ON public.retention_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update retention_alerts"
  ON public.retention_alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert retention_alerts"
  ON public.retention_alerts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can delete retention_alerts"
  ON public.retention_alerts FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX idx_retention_alerts_active_user 
  ON public.retention_alerts (user_id) WHERE status = 'active';
