CREATE TABLE IF NOT EXISTS public.review_request_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL UNIQUE,
  google_review_url TEXT,
  twilio_number TEXT,
  request_message TEXT DEFAULT 'Hi {name}! Thanks for choosing {business}. If you had a great experience, we''d love a quick Google review: {url} — It really helps us out!',
  stripe_subscription_id TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  requests_sent INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.review_request_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages review_request_clients"
  ON public.review_request_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
