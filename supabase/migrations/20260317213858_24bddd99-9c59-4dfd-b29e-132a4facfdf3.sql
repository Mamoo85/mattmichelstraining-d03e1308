
-- Add trial flag to training_programs
ALTER TABLE public.training_programs ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false;

-- Add trial_started_at to profiles for tracking trial expiry
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at timestamp with time zone DEFAULT NULL;
