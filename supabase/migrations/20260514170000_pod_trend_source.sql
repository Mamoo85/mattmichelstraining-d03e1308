-- Add source column to etsy_pod_trends to track where each trend originated
ALTER TABLE etsy_pod_trends ADD COLUMN IF NOT EXISTS source text DEFAULT 'etsy';
