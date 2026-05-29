-- Contractor Pay-Per-Lead (PPL) automation tables and columns
-- Adds soft lock + purchases table for $50/lead exclusive marketplace

-- Add PPL columns to contractor_leads
ALTER TABLE contractor_leads ADD COLUMN IF NOT EXISTS paid_by_contractor_id uuid;
ALTER TABLE contractor_leads ADD COLUMN IF NOT EXISTS payment_amount_cents int;
ALTER TABLE contractor_leads ADD COLUMN IF NOT EXISTS payment_session_id text;
ALTER TABLE contractor_leads ADD COLUMN IF NOT EXISTS checkout_locked_by uuid;
ALTER TABLE contractor_leads ADD COLUMN IF NOT EXISTS lock_expires_at timestamptz;
-- status values: 'new' | 'notified' | 'pending_checkout' | 'sold'

-- Audit trail for all PPL purchases
CREATE TABLE IF NOT EXISTS contractor_lead_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  amount_cents int NOT NULL DEFAULT 5000,
  stripe_session_id text,
  purchased_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contractor_lead_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON contractor_lead_purchases
  FOR ALL USING (true) WITH CHECK (true);
