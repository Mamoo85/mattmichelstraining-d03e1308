ALTER TABLE public.training_programs 
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';