
-- Rename age_range to level and update values
ALTER TABLE public.training_programs RENAME COLUMN age_range TO level;
ALTER TABLE public.training_programs ALTER COLUMN level SET DEFAULT 'Beginner';

-- Remove sex column
ALTER TABLE public.training_programs DROP COLUMN sex;
