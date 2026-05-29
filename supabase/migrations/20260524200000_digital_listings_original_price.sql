-- Add original_price_cents to both digital listing tables so patchPrices can restore later
ALTER TABLE etsy_digital_listings
  ADD COLUMN IF NOT EXISTS original_price_cents int;

ALTER TABLE pod_digital_products
  ADD COLUMN IF NOT EXISTS original_price_cents int;
