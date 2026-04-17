ALTER TABLE public.contractor_clients
ADD COLUMN IF NOT EXISTS last_roi_sms_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contractor_clients_last_roi_sms
  ON public.contractor_clients (last_roi_sms_sent_at);