-- B2B Website Trauma Audit Queue
-- Stores scraped business data, homepage inspection results, and audit text
-- for the cold email outreach pipeline.

CREATE TABLE IF NOT EXISTS b2b_audit_queue (
  id            bigserial    PRIMARY KEY,
  business_name text         NOT NULL,
  website_url   text         NOT NULL,
  email         text,
  phone         text,
  industry      text,
  city          text,
  trauma_points jsonb,       -- { mobile_viewport: bool, contact_form: bool, ... }
  audit_text    text,        -- 200-word generated revenue leak paragraph
  audit_status  text         NOT NULL DEFAULT 'pending',  -- pending|inspected|audited|sent
  sent_at       timestamptz,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE b2b_audit_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON b2b_audit_queue
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS b2b_audit_queue_status_idx ON b2b_audit_queue (audit_status);
CREATE INDEX IF NOT EXISTS b2b_audit_queue_email_idx ON b2b_audit_queue (email);
