ALTER TABLE public.missed_call_clients ADD COLUMN IF NOT EXISTS bundled_from text;
ALTER TABLE public.review_alert_clients ADD COLUMN IF NOT EXISTS bundled_from text;
ALTER TABLE public.quote_followup_clients ADD COLUMN IF NOT EXISTS bundled_from text;
CREATE INDEX IF NOT EXISTS idx_missed_call_clients_bundled_from ON public.missed_call_clients(bundled_from) WHERE bundled_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_review_alert_clients_bundled_from ON public.review_alert_clients(bundled_from) WHERE bundled_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quote_followup_clients_bundled_from ON public.quote_followup_clients(bundled_from) WHERE bundled_from IS NOT NULL;