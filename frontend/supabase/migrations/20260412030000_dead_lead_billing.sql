-- Add Stripe billing fields to contractor_clients for per-reply auto-charging
ALTER TABLE contractor_clients
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT,
  ADD COLUMN IF NOT EXISTS dead_lead_billing_active BOOLEAN DEFAULT false;

-- Track per-reply charges
CREATE TABLE IF NOT EXISTS dead_lead_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES dead_lead_contacts(id),
  contractor_id uuid NOT NULL,
  amount_cents int NOT NULL DEFAULT 5000,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'pending', -- pending | succeeded | failed
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dead_lead_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON dead_lead_charges FOR ALL USING (true) WITH CHECK (true);
