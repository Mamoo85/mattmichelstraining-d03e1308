ALTER TABLE public.profiles 
  ADD COLUMN daily_protein_goal integer DEFAULT 150,
  ADD COLUMN daily_carbs_goal integer DEFAULT 250,
  ADD COLUMN daily_fat_goal integer DEFAULT 65;