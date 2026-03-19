CREATE TABLE public.master_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  experience_level TEXT NOT NULL,
  program_duration TEXT NOT NULL,
  primary_focus TEXT NOT NULL,
  equipment TEXT[] NOT NULL DEFAULT '{}',
  ai_findings JSONB,
  program JSONB NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.master_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage master_templates"
  ON public.master_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));