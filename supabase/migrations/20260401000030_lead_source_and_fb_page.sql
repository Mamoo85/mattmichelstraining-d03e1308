-- Add source tracking to contractor_leads so Matt can see where each lead came from
-- (direct form, facebook ad, nextdoor, referral, etc.)
ALTER TABLE contractor_leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'direct';

-- Add facebook_page_id to contractor_lead_sites so the Facebook Lead Ads webhook
-- can route incoming leads to the correct territory
ALTER TABLE contractor_lead_sites ADD COLUMN IF NOT EXISTS facebook_page_id TEXT;
