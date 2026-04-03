CREATE TABLE employee_credential_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text NOT NULL,
  company_name text NOT NULL,
  employee_emails text[] NOT NULL,
  stripe_session_id text,
  status text DEFAULT 'pending', -- pending, processing, complete, failed
  total_checked integer DEFAULT 0,
  total_breached integer DEFAULT 0,
  report_sent boolean DEFAULT false,
  is_test boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE employee_credential_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role all" ON employee_credential_audits FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "customer reads own" ON employee_credential_audits FOR SELECT TO authenticated USING (customer_email = auth.jwt()->>'email');
