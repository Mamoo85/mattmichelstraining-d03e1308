
CREATE TABLE IF NOT EXISTS public.agent_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT UNIQUE NOT NULL,
  last_beat TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

ALTER TABLE public.agent_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on agent_heartbeats"
  ON public.agent_heartbeats FOR ALL
  USING (true) WITH CHECK (true);

-- Seed initial heartbeat records for active agents
INSERT INTO public.agent_heartbeats (agent_name) VALUES
  ('Oz'), ('Tom'), ('Shield'), ('Cashier'), ('Pulse'),
  ('Scout'), ('Hype'), ('Drill'), ('Ref'), ('Selma'), ('Scarlett'), ('Ops'), ('Mute')
ON CONFLICT (agent_name) DO NOTHING;
