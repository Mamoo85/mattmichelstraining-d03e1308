CREATE TABLE IF NOT EXISTS public.sms_reply_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  draft_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  inbound_message_id TEXT,
  inbound_body TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sms_reply_drafts_phone_pending
  ON public.sms_reply_drafts(phone, created_at DESC)
  WHERE status = 'pending';

ALTER TABLE public.sms_reply_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_sms_reply_drafts"
  ON public.sms_reply_drafts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');