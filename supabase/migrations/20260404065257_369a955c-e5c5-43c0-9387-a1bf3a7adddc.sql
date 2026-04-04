CREATE TABLE public.ad_campaign_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  platform TEXT NOT NULL,
  campaign_content TEXT NOT NULL,
  projected_cac NUMERIC,
  projected_ltv NUMERIC,
  projected_roas NUMERIC,
  monthly_budget NUMERIC,
  target_audience TEXT,
  keywords TEXT[],
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_campaign_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on ad_campaign_queue"
  ON public.ad_campaign_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can manage ad campaigns"
  ON public.ad_campaign_queue
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));