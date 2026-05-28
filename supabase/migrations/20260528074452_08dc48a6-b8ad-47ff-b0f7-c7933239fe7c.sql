CREATE TABLE IF NOT EXISTS public.scanner_heartbeats (
  id BIGSERIAL PRIMARY KEY,
  scanner_name TEXT NOT NULL,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'ok',
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS scanner_heartbeats_scanner_ran_idx ON public.scanner_heartbeats (scanner_name, ran_at DESC);
GRANT ALL ON public.scanner_heartbeats TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.scanner_heartbeats_id_seq TO service_role;
ALTER TABLE public.scanner_heartbeats ENABLE ROW LEVEL SECURITY;
CREATE POLICY scanner_heartbeats_service_all ON public.scanner_heartbeats FOR ALL TO service_role USING (true) WITH CHECK (true);