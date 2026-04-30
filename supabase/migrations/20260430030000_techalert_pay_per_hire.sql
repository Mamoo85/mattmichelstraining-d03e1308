-- TechAlert pay-per-hire tier: store saved payment method for per-hire charging

ALTER TABLE public.hire_alert_clients
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text DEFAULT NULL;
