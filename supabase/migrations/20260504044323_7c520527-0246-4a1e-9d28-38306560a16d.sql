CREATE TABLE IF NOT EXISTS public.manual_onboarding_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug text NOT NULL,
  product_label text NOT NULL,
  customer_email text,
  stripe_session_id text UNIQUE,
  stripe_subscription_id text,
  amount_paid_cents integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','skipped')),
  notes text,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moq_status_created ON public.manual_onboarding_queue(status, created_at DESC);

ALTER TABLE public.manual_onboarding_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage manual onboarding queue"
ON public.manual_onboarding_queue FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access manual onboarding"
ON public.manual_onboarding_queue FOR ALL
TO service_role
USING (true) WITH CHECK (true);