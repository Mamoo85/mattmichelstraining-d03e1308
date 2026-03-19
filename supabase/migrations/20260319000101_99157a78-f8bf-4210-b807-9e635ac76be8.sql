
CREATE TABLE public.nutrition_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT,
  food_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_calories INTEGER NOT NULL DEFAULT 0,
  total_protein_g NUMERIC(6,1) NOT NULL DEFAULT 0,
  total_carbs_g NUMERIC(6,1) NOT NULL DEFAULT 0,
  total_fat_g NUMERIC(6,1) NOT NULL DEFAULT 0,
  total_fiber_g NUMERIC(6,1) NOT NULL DEFAULT 0,
  meal_label TEXT DEFAULT 'snack',
  notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nutrition logs"
  ON public.nutrition_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nutrition logs"
  ON public.nutrition_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own nutrition logs"
  ON public.nutrition_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
