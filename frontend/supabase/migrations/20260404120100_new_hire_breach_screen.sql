CREATE TABLE new_hire_breach_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_email text NOT NULL,
  candidate_name text NOT NULL,
  candidate_email text NOT NULL,
  stripe_session_id text,
  breach_count integer DEFAULT 0,
  has_password_breach boolean DEFAULT false,
  risk_level text DEFAULT 'pending', -- pending, clean, low, medium, high, critical
  report_sent boolean DEFAULT false,
  is_test boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE new_hire_breach_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role all" ON new_hire_breach_checks FOR ALL TO service_role USING (true) WITH CHECK (true);
