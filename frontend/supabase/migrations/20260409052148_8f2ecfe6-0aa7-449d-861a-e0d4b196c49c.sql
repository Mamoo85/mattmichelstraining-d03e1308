CREATE TABLE public.free_tool_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  tool_used TEXT NOT NULL,
  input_url TEXT,
  results_summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.free_tool_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on free_tool_leads"
  ON public.free_tool_leads
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can insert free_tool_leads"
  ON public.free_tool_leads
  FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_free_tool_leads_email ON public.free_tool_leads (email);
CREATE INDEX idx_free_tool_leads_tool ON public.free_tool_leads (tool_used);