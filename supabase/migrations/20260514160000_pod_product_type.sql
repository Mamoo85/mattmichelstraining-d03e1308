-- Add product_type to pod_designs for mug vs shirt routing
ALTER TABLE pod_designs ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'mug';
