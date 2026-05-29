-- Lead Activities: universal activity log per pipeline lead
CREATE TABLE IF NOT EXISTS lead_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  lead_table TEXT NOT NULL DEFAULT 'prospect_pipeline',
  type TEXT NOT NULL,  -- email_sent | reply_received | call_logged | note | meeting_booked | deal_won | deal_lost | stage_changed | audited | researched
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on lead_activities"
  ON lead_activities FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admin select lead_activities"
  ON lead_activities FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admin insert lead_activities"
  ON lead_activities FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admin delete lead_activities"
  ON lead_activities FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON lead_activities(created_at DESC);

-- Deal tracking + stale detection columns on prospect_pipeline
ALTER TABLE prospect_pipeline
  ADD COLUMN IF NOT EXISTS deal_value INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS close_probability INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS next_action_date DATE,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reply_received_at TIMESTAMPTZ;
