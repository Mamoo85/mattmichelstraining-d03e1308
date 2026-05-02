CREATE TABLE IF NOT EXISTS public.client_email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'value_report',
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('weekly','monthly','off')),
  unsubscribe_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  last_sent_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'auto',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cep_email_type
  ON public.client_email_preferences (lower(client_email), report_type);
CREATE INDEX IF NOT EXISTS idx_cep_token
  ON public.client_email_preferences (unsubscribe_token);
CREATE INDEX IF NOT EXISTS idx_cep_due
  ON public.client_email_preferences (frequency, last_sent_at) WHERE frequency <> 'off';

ALTER TABLE public.client_email_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role bypass cep" ON public.client_email_preferences;
CREATE POLICY "service role bypass cep" ON public.client_email_preferences
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin all cep" ON public.client_email_preferences;
CREATE POLICY "admin all cep" ON public.client_email_preferences
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.set_updated_at_cep()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_cep_updated_at ON public.client_email_preferences;
CREATE TRIGGER trg_cep_updated_at BEFORE UPDATE ON public.client_email_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_cep();

INSERT INTO public.client_email_preferences (client_email, report_type, frequency, source)
SELECT DISTINCT lower(client_email), 'value_report', 'weekly', 'backfill'
FROM public.client_price_locks
WHERE active = true
ON CONFLICT DO NOTHING;