ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_email_send_log_resend_id
  ON public.email_send_log ((metadata->>'resend_email_id'))
  WHERE metadata ? 'resend_email_id';

CREATE INDEX IF NOT EXISTS idx_email_send_log_opened
  ON public.email_send_log (opened_at DESC) WHERE opened_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_send_log_clicked
  ON public.email_send_log (clicked_at DESC) WHERE clicked_at IS NOT NULL;