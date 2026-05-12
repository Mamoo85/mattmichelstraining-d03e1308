ALTER TABLE public.techalert_prospect_targets
  ADD COLUMN IF NOT EXISTS reply_body              text,
  ADD COLUMN IF NOT EXISTS follow_up_call_completed timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribe_reason      text,
  ADD COLUMN IF NOT EXISTS postcard_queue          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS postcard_sent_at        timestamptz;

CREATE INDEX IF NOT EXISTS idx_techalert_hot_replies
  ON public.techalert_prospect_targets (reply_positive, follow_up_call_completed)
  WHERE reply_positive = true AND follow_up_call_completed IS NULL;

CREATE INDEX IF NOT EXISTS idx_techalert_postcard_queue
  ON public.techalert_prospect_targets (postcard_queue, postcard_sent_at)
  WHERE postcard_queue = true AND postcard_sent_at IS NULL;