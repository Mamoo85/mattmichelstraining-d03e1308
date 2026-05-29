-- Fix: training_programs base table exposes stripe_product_id and stripe_price_id to anon
DROP POLICY IF EXISTS "Public can view active programs" ON public.training_programs;

-- Fix: generated_sites base table exposes phone and email to anon
DROP POLICY IF EXISTS "Public can view published sites" ON public.generated_sites;