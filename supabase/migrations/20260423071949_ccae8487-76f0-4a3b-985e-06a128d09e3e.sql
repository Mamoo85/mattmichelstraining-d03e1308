DELETE FROM public.missed_call_clients a USING public.missed_call_clients b WHERE a.id > b.id AND lower(a.email) = lower(b.email);
CREATE UNIQUE INDEX IF NOT EXISTS missed_call_clients_email_unique ON public.missed_call_clients ((lower(email)));
DELETE FROM public.industry_pulse_clients a USING public.industry_pulse_clients b WHERE a.id > b.id AND lower(a.email) = lower(b.email);
CREATE UNIQUE INDEX IF NOT EXISTS industry_pulse_clients_email_unique ON public.industry_pulse_clients ((lower(email)));