ALTER TABLE public.sms_reply_drafts
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_sms_reply_drafts_metadata_source
  ON public.sms_reply_drafts ((metadata->>'source'))
  WHERE status = 'pending';