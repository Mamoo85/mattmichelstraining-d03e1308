-- Add eBay tracking columns to kdp_books, whop_products
-- Add preview_image_url to etsy_digital_listings for image re-hosting

ALTER TABLE kdp_books
  ADD COLUMN IF NOT EXISTS ebay_item_id TEXT,
  ADD COLUMN IF NOT EXISTS ebay_listed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_kdp_books_ebay_item_id ON kdp_books(ebay_item_id);

ALTER TABLE whop_products
  ADD COLUMN IF NOT EXISTS ebay_item_id TEXT,
  ADD COLUMN IF NOT EXISTS ebay_listed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_whop_products_ebay_item_id ON whop_products(ebay_item_id);

ALTER TABLE etsy_digital_listings
  ADD COLUMN IF NOT EXISTS preview_image_url TEXT;

CREATE INDEX IF NOT EXISTS idx_etsy_digital_listings_preview ON etsy_digital_listings(preview_image_url)
  WHERE preview_image_url IS NOT NULL;
