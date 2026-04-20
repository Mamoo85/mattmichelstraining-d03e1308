-- Add columns for the new multi-offer postcard landing page tracking
ALTER TABLE public.postcard_conversions
  ADD COLUMN IF NOT EXISTS audience_type text,
  ADD COLUMN IF NOT EXISTS product_key text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS referrer text;

-- Allow anonymous inserts so the public /postcard landing page can log scans + clicks
-- (reads remain admin-only via existing policies)
DROP POLICY IF EXISTS "Anyone can log postcard conversions" ON public.postcard_conversions;
CREATE POLICY "Anyone can log postcard conversions"
  ON public.postcard_conversions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);