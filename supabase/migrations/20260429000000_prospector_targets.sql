-- prospector_targets: DB-driven city/trade config for channel-prospector.
-- Replaces hardcoded DEFAULT_CITIES + DEFAULT_TRADES arrays.
-- Add rows here to expand coverage to Ohio, Indiana, Illinois, Texas, etc.
-- with zero code deploys. channel-prospector reads this table on every run.

CREATE TABLE IF NOT EXISTS public.prospector_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  trade         TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (city, state, trade)
);

ALTER TABLE public.prospector_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass prospector_targets" ON public.prospector_targets
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Admin read (for the admin panel market toggle)
CREATE POLICY "admin read prospector_targets" ON public.prospector_targets
  FOR SELECT USING (has_role('admin'::app_role));

-- Seed existing Michigan defaults so channel-prospector works on day 1
INSERT INTO public.prospector_targets (city, state, trade, active) VALUES
  ('Detroit',         'MI', 'roofer',            true),
  ('Detroit',         'MI', 'HVAC contractor',   true),
  ('Detroit',         'MI', 'plumber',            true),
  ('Detroit',         'MI', 'electrician',        true),
  ('Warren',          'MI', 'roofer',            true),
  ('Warren',          'MI', 'HVAC contractor',   true),
  ('Warren',          'MI', 'plumber',            true),
  ('Warren',          'MI', 'electrician',        true),
  ('Sterling Heights','MI', 'roofer',            true),
  ('Sterling Heights','MI', 'HVAC contractor',   true),
  ('Troy',            'MI', 'plumber',            true),
  ('Troy',            'MI', 'electrician',        true),
  ('Royal Oak',       'MI', 'roofer',            true),
  ('Livonia',         'MI', 'HVAC contractor',   true),
  -- Ohio (activate by setting active=true in admin panel)
  ('Cleveland',       'OH', 'roofer',            false),
  ('Cleveland',       'OH', 'HVAC contractor',   false),
  ('Cleveland',       'OH', 'plumber',            false),
  ('Cleveland',       'OH', 'electrician',        false),
  ('Columbus',        'OH', 'roofer',            false),
  ('Columbus',        'OH', 'HVAC contractor',   false),
  ('Columbus',        'OH', 'plumber',            false),
  ('Columbus',        'OH', 'electrician',        false),
  ('Cincinnati',      'OH', 'roofer',            false),
  ('Cincinnati',      'OH', 'HVAC contractor',   false),
  -- Indiana
  ('Indianapolis',    'IN', 'roofer',            false),
  ('Indianapolis',    'IN', 'HVAC contractor',   false),
  ('Indianapolis',    'IN', 'plumber',            false),
  ('Indianapolis',    'IN', 'electrician',        false),
  -- Illinois
  ('Chicago',         'IL', 'roofer',            false),
  ('Chicago',         'IL', 'HVAC contractor',   false),
  ('Chicago',         'IL', 'plumber',            false),
  ('Chicago',         'IL', 'electrician',        false),
  -- Texas
  ('Dallas',          'TX', 'roofer',            false),
  ('Dallas',          'TX', 'HVAC contractor',   false),
  ('Houston',         'TX', 'roofer',            false),
  ('Houston',         'TX', 'HVAC contractor',   false),
  ('San Antonio',     'TX', 'roofer',            false),
  -- Tennessee
  ('Nashville',       'TN', 'roofer',            false),
  ('Nashville',       'TN', 'HVAC contractor',   false)
ON CONFLICT (city, state, trade) DO NOTHING;
