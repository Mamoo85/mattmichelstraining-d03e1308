-- Free tier for dead lead reactivation (2 contacts max, no card required)
ALTER TABLE contractor_clients
  ADD COLUMN IF NOT EXISTS free_tier_used BOOLEAN DEFAULT false;

ALTER TABLE dead_lead_campaigns
  ADD COLUMN IF NOT EXISTS is_free_trial BOOLEAN DEFAULT false;
