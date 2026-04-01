CREATE TABLE public.search_console_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_url TEXT NOT NULL,
  query TEXT,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr NUMERIC(5,4) DEFAULT 0,
  position NUMERIC(5,1) DEFAULT 0,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(page_url, query, date)
);

ALTER TABLE public.search_console_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage GSC data" ON public.search_console_data
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_gsc_page_date ON public.search_console_data(page_url, date DESC);
CREATE INDEX idx_gsc_date ON public.search_console_data(date DESC);