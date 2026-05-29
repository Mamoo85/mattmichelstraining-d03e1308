-- Bounty 1: License Monitor MMS Vision intake

-- Add intake tracking columns to license_monitor_items
ALTER TABLE license_monitor_items ADD COLUMN IF NOT EXISTS intake_method text DEFAULT 'manual';
-- intake_method: 'manual' | 'vision_mms' | 'lara_scrape'
ALTER TABLE license_monitor_items ADD COLUMN IF NOT EXISTS source_image_url text;
