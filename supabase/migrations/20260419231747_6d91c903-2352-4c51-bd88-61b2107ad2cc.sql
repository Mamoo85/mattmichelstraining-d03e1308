CREATE TABLE IF NOT EXISTS public.lara_prefix_cursors (
  prefix text PRIMARY KEY,
  last_id integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lara_prefix_cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_lara_prefix_cursors"
ON public.lara_prefix_cursors
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Seed starting IDs for each LARA license prefix (mirrors VAL pattern starting near current issuance range)
INSERT INTO public.lara_prefix_cursors (prefix, last_id) VALUES
  ('VAL', 6500000),
  ('ELE', 6400000),
  ('PLM', 6400000),
  ('BOI', 6400000),
  ('MEC', 6400000)
ON CONFLICT (prefix) DO NOTHING;