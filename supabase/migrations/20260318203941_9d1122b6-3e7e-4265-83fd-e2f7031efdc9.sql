ALTER TABLE public.monthly_focus
  ADD COLUMN IF NOT EXISTS biomechanics text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS common_mistakes text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS challenge_metric text DEFAULT '';