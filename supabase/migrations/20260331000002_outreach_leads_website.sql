-- Add website URL column to outreach_leads
-- The existing website_status column (enum: None/Outdated/Basic/Good) remains
-- This adds a separate website URL field used by AdminOutreach Kanban + audit pitch generator
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS website TEXT;
