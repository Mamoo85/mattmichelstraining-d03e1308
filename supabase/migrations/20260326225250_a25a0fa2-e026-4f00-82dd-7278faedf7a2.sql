DROP VIEW IF EXISTS public.training_programs_public;

CREATE VIEW public.training_programs_public
WITH (security_invoker = on) AS
SELECT id, title, description, category, level, sport, price, total_weeks, is_active, created_at
FROM public.training_programs
WHERE is_active = true;