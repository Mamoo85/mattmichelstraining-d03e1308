ALTER TABLE public.user_active_programs
  ADD COLUMN IF NOT EXISTS current_week integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_day integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS block_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS completed_days jsonb NOT NULL DEFAULT '[]'::jsonb;