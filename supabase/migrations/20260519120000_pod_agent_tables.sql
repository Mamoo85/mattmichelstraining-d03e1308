-- pod_agent_state: persistent key-value store for agent state
-- Used by pod-seo-agent to track the rolling SEO sweep offset across daily runs.
-- Other agents can use it for any stateful value that needs to survive between invocations.

CREATE TABLE IF NOT EXISTS pod_agent_state (
  key        text PRIMARY KEY,
  value      text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pod_agent_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access" ON pod_agent_state
  FOR ALL USING (auth.role() = 'service_role');

-- Seed initial state
INSERT INTO pod_agent_state (key, value)
  VALUES ('seo_offset', '0')
  ON CONFLICT (key) DO NOTHING;
