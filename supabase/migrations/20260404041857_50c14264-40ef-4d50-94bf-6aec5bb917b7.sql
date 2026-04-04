CREATE TABLE public.matt_jokes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  joke_text TEXT NOT NULL,
  attribution TEXT NOT NULL DEFAULT '"You miss 100% of the shots you don''t take" — Wayne Gretzky — Michael Scott — Matt Michels',
  category TEXT NOT NULL DEFAULT 'signature',
  use_in_emails BOOLEAN NOT NULL DEFAULT false,
  use_in_sites BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.matt_jokes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view jokes" ON public.matt_jokes FOR SELECT USING (true);
CREATE POLICY "Service role manages jokes" ON public.matt_jokes FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.matt_jokes (joke_text, attribution, category, use_in_emails, use_in_sites) VALUES
('"You miss 100% of the shots you don''t take"', '— Wayne Gretzky  — Michael Scott  — Matt Michels', 'signature', true, true);