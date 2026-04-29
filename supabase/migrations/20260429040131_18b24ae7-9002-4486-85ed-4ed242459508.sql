CREATE TABLE IF NOT EXISTS public.prospector_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  trade         TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (city, state, trade)
);

ALTER TABLE public.prospector_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass prospector_targets" ON public.prospector_targets
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admin read prospector_targets" ON public.prospector_targets
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin update prospector_targets" ON public.prospector_targets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.touch_prospector_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS prospector_targets_set_updated_at ON public.prospector_targets;
CREATE TRIGGER prospector_targets_set_updated_at
  BEFORE UPDATE ON public.prospector_targets
  FOR EACH ROW EXECUTE FUNCTION public.touch_prospector_targets_updated_at();

INSERT INTO public.prospector_targets (city, state, trade, active) VALUES
  ('Detroit',         'MI', 'roofer',            true),
  ('Detroit',         'MI', 'HVAC contractor',   true),
  ('Detroit',         'MI', 'plumber',           true),
  ('Detroit',         'MI', 'electrician',       true),
  ('Warren',          'MI', 'roofer',            true),
  ('Warren',          'MI', 'HVAC contractor',   true),
  ('Warren',          'MI', 'plumber',           true),
  ('Warren',          'MI', 'electrician',       true),
  ('Sterling Heights','MI', 'roofer',            true),
  ('Sterling Heights','MI', 'HVAC contractor',   true),
  ('Troy',            'MI', 'plumber',           true),
  ('Troy',            'MI', 'electrician',       true),
  ('Royal Oak',       'MI', 'roofer',            true),
  ('Livonia',         'MI', 'HVAC contractor',   true),
  ('Cleveland',       'OH', 'roofer',            false),
  ('Cleveland',       'OH', 'HVAC contractor',   false),
  ('Cleveland',       'OH', 'plumber',           false),
  ('Cleveland',       'OH', 'electrician',       false),
  ('Columbus',        'OH', 'roofer',            false),
  ('Columbus',        'OH', 'HVAC contractor',   false),
  ('Columbus',        'OH', 'plumber',           false),
  ('Columbus',        'OH', 'electrician',       false),
  ('Cincinnati',      'OH', 'roofer',            false),
  ('Cincinnati',      'OH', 'HVAC contractor',   false),
  ('Indianapolis',    'IN', 'roofer',            false),
  ('Indianapolis',    'IN', 'HVAC contractor',   false),
  ('Indianapolis',    'IN', 'plumber',           false),
  ('Indianapolis',    'IN', 'electrician',       false),
  ('Chicago',         'IL', 'roofer',            false),
  ('Chicago',         'IL', 'HVAC contractor',   false),
  ('Chicago',         'IL', 'plumber',           false),
  ('Chicago',         'IL', 'electrician',       false),
  ('Dallas',          'TX', 'roofer',            false),
  ('Dallas',          'TX', 'HVAC contractor',   false),
  ('Houston',         'TX', 'roofer',            false),
  ('Houston',         'TX', 'HVAC contractor',   false),
  ('San Antonio',     'TX', 'roofer',            false),
  ('Phoenix',         'AZ', 'roofer',            false),
  ('Phoenix',         'AZ', 'HVAC contractor',   false),
  ('Atlanta',         'GA', 'roofer',            false),
  ('Atlanta',         'GA', 'HVAC contractor',   false),
  ('Nashville',       'TN', 'roofer',            false),
  ('Nashville',       'TN', 'HVAC contractor',   false)
ON CONFLICT (city, state, trade) DO NOTHING;