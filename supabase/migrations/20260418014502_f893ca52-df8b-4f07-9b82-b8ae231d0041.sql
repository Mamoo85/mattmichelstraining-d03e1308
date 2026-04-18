-- Backfill TOS acceptance for the DJ Conley demo client (admin-inserted, no checkout flow)
-- Going forward, both create-hire-alert-checkout and create-hire-alert-trial stamp this automatically.
UPDATE public.hire_alert_clients
SET tos_accepted_at = COALESCE(tos_accepted_at, now()),
    tos_version = COALESCE(tos_version, '2026-04-fcra')
WHERE tos_accepted_at IS NULL
  AND (active = true OR trial_status = 'active');