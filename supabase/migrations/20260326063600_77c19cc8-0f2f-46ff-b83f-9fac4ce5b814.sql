
-- Fix: make the view use SECURITY INVOKER (the default, safe option)
CREATE OR REPLACE VIEW public.training_programs_public
WITH (security_invoker = true) AS
SELECT id, title, description, category, level, sport, price, total_weeks, is_active, created_at
FROM public.training_programs
WHERE is_active = true;
