
-- Add auto_regulate preference to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_regulate boolean NOT NULL DEFAULT false;

-- Add barbell_alternative_id to exercise_library (self-referencing for swap mapping)
ALTER TABLE public.exercise_library ADD COLUMN IF NOT EXISTS barbell_alternative_id uuid REFERENCES public.exercise_library(id) ON DELETE SET NULL DEFAULT NULL;

-- Create readiness_checks table for pre-workout check-ins
CREATE TABLE public.readiness_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hours_slept numeric NOT NULL,
  weight_adjustment_pct integer NOT NULL DEFAULT 0,
  swaps_applied boolean NOT NULL DEFAULT false,
  checked_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_readiness_checks_user_date ON public.readiness_checks (user_id, checked_at DESC);

-- Enable RLS
ALTER TABLE public.readiness_checks ENABLE ROW LEVEL SECURITY;

-- Users can insert own readiness checks
CREATE POLICY "Users can insert own readiness checks"
  ON public.readiness_checks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view own readiness checks
CREATE POLICY "Users can view own readiness checks"
  ON public.readiness_checks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all readiness checks
CREATE POLICY "Admins can view all readiness checks"
  ON public.readiness_checks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
