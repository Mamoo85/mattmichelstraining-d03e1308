-- pod_dimension_audit — tracks which Printify products need image repair
-- Used by pod-republish-wrong-dims to process one product per call (fits within 150s timeout).

CREATE TABLE IF NOT EXISTS pod_dimension_audit (
  id           BIGSERIAL PRIMARY KEY,
  printify_id  TEXT NOT NULL UNIQUE,
  title        TEXT,
  blueprint_id INT,
  product_type TEXT,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | repaired | error | skipped
  error_msg    TEXT,
  repaired_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pod_dimension_audit_status ON pod_dimension_audit(status);
