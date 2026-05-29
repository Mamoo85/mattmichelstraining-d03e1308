
-- Enable RLS on newsletter_subscribers
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers FORCE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on newsletter_subscribers"
  ON public.newsletter_subscribers FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anon can insert newsletter subscribers"
  ON public.newsletter_subscribers FOR INSERT TO anon WITH CHECK (true);

-- Enable RLS on newsletter_sends
ALTER TABLE public.newsletter_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_sends FORCE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on newsletter_sends"
  ON public.newsletter_sends FOR ALL TO service_role USING (true) WITH CHECK (true);
