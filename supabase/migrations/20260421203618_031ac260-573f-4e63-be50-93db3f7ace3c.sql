ALTER TABLE public.contractor_welcome_log
  ADD COLUMN IF NOT EXISTS stale_alerted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS contractor_welcome_log_stale_idx
  ON public.contractor_welcome_log (status, created_at)
  WHERE status = 'queued' AND stale_alerted = false;