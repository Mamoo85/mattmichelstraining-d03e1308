
ALTER TABLE public.postcard_send_log
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expected_delivery_date DATE,
  ADD COLUMN IF NOT EXISTS tracking_events JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.postcard_campaigns
  ADD COLUMN IF NOT EXISTS delivered_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returned_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS total_cost_cents INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_postcard_send_log_lob_id ON public.postcard_send_log(lob_id) WHERE lob_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_postcard_send_log_campaign_id ON public.postcard_send_log(campaign_id);
