-- Partial failure recovery on processed_stripe_events
ALTER TABLE public.processed_stripe_events
  ADD COLUMN IF NOT EXISTS fulfillment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS fulfillment_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS fulfillment_error text;

CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_pending
  ON public.processed_stripe_events (processed_at)
  WHERE fulfillment_status = 'pending';

-- Tech session tokens (PIN-based field tech auth)
CREATE TABLE IF NOT EXISTS public.tech_sessions (
  token text PRIMARY KEY,
  tech_id uuid NOT NULL,
  client_id uuid NOT NULL,
  tech_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tech_sessions_expires_at
  ON public.tech_sessions (expires_at);

ALTER TABLE public.tech_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role manages tech_sessions" ON public.tech_sessions;
CREATE POLICY "service_role manages tech_sessions"
  ON public.tech_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);