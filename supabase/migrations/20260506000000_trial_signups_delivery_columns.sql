-- E1: Add delivery-tracking columns to trial_signups.
-- These power the SLA watchdog, auto-compensation, and Trial Health admin tab.
-- Builds on the existing trial_signups table (created in 20260503234005).

ALTER TABLE public.trial_signups
  ADD COLUMN IF NOT EXISTS first_lead_delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_status TEXT NOT NULL DEFAULT 'green',
  ADD COLUMN IF NOT EXISTS compensation_applied BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compensation_reason TEXT;

COMMENT ON COLUMN public.trial_signups.first_lead_delivered_at IS 'Timestamp of the first qualified lead delivered to this trial client. NULL = no lead delivered yet.';
COMMENT ON COLUMN public.trial_signups.sla_status IS 'green = on track | amber = no lead by day 2 | red = no lead by day 4 (triggers auto-compensation)';
COMMENT ON COLUMN public.trial_signups.compensation_applied IS 'True once trial has been auto-extended due to underdelivery';
COMMENT ON COLUMN public.trial_signups.compensation_reason IS 'Human-readable description of why compensation was applied';
