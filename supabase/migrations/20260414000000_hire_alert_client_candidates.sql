-- TA-9: Client-specific candidate tracking
-- Records which candidates were alerted to which TechAlert clients.
-- Enables competitive urgency ("2 other companies saw this candidate") and engagement tracking.

CREATE TABLE IF NOT EXISTS hire_alert_client_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES hire_alert_clients(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES hire_alert_candidates(id) ON DELETE CASCADE,
  alerted_at timestamptz NOT NULL DEFAULT now(),
  client_action text, -- 'viewed' | 'contacted' | 'hired' | null
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, candidate_id)
);

ALTER TABLE hire_alert_client_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_hire_alert_client_candidates"
  ON hire_alert_client_candidates FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_hacc_client ON hire_alert_client_candidates(client_id);
CREATE INDEX IF NOT EXISTS idx_hacc_candidate ON hire_alert_client_candidates(candidate_id);
CREATE INDEX IF NOT EXISTS idx_hacc_alerted ON hire_alert_client_candidates(alerted_at DESC);
