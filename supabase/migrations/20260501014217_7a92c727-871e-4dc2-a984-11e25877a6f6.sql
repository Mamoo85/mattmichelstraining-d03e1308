ALTER TABLE public.outreach_send_queue
  ADD COLUMN IF NOT EXISTS source_run_id uuid;

CREATE INDEX IF NOT EXISTS idx_send_queue_source_run
  ON public.outreach_send_queue (source_run_id, created_at DESC)
  WHERE source_run_id IS NOT NULL;