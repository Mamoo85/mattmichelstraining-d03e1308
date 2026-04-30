-- Add first_look_active flag to marketplace_lead_locks
-- Set true when a First Look subscriber claims/locks a lead before public window opens.

ALTER TABLE public.marketplace_lead_locks
  ADD COLUMN IF NOT EXISTS first_look_active boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_marketplace_lead_locks_first_look
  ON public.marketplace_lead_locks (first_look_active)
  WHERE first_look_active = true;
