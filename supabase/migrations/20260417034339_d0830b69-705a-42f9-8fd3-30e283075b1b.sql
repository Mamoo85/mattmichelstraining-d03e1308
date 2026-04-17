-- The Wire — contractor leads marketplace subscription
CREATE TABLE public.wire_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  trades TEXT[] DEFAULT '{}',
  cities TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  digest_enabled BOOLEAN DEFAULT true,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  last_digest_sent_at TIMESTAMPTZ
);

CREATE INDEX idx_wire_subscribers_active ON public.wire_subscribers(active) WHERE active = true;
CREATE INDEX idx_wire_subscribers_email ON public.wire_subscribers(email);

ALTER TABLE public.wire_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_wire_subscribers"
  ON public.wire_subscribers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admin_all_wire_subscribers"
  ON public.wire_subscribers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Track which leads have been emailed in digests (prevent dupes)
CREATE TABLE public.wire_digest_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES public.wire_subscribers(id) ON DELETE CASCADE,
  lead_id UUID,
  sent_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(subscriber_id, lead_id)
);

CREATE INDEX idx_wire_digest_log_subscriber ON public.wire_digest_log(subscriber_id, sent_at DESC);

ALTER TABLE public.wire_digest_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_wire_digest_log"
  ON public.wire_digest_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');