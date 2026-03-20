
CREATE TABLE public.ai_marketing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_week DATE NOT NULL,
  raw_analytics JSONB DEFAULT '{}'::jsonb,
  ai_analysis JSONB DEFAULT '{}'::jsonb,
  summary_text TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_marketing_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read marketing reports"
  ON public.ai_marketing_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage marketing reports"
  ON public.ai_marketing_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert marketing reports"
  ON public.ai_marketing_reports FOR INSERT
  WITH CHECK (true);
