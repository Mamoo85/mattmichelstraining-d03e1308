-- Add urgency and category columns to notifications for smart notification system
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'fyi',
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

-- Add check constraint for urgency values
DO $$ BEGIN
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_urgency_check
    CHECK (urgency IN ('action', 'hot_lead', 'fyi', 'celebration'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
