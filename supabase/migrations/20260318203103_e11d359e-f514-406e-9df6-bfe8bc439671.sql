
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  ai_suggestion TEXT,
  ai_actions JSONB DEFAULT '[]'::jsonb,
  admin_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own tickets" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tickets" ON public.support_tickets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage tickets" ON public.support_tickets
  FOR ALL TO service_role USING (true) WITH CHECK (true);
