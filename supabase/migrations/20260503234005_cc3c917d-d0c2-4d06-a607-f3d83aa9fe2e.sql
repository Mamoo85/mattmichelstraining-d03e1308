-- Trial signup tracking
CREATE TABLE IF NOT EXISTS public.trial_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT,
  product_key TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  user_id UUID,
  trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  converted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active', -- active | converted | cancelled | expired
  utm JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_signups_status ON public.trial_signups(status);
CREATE INDEX IF NOT EXISTS idx_trial_signups_email ON public.trial_signups(email);
CREATE INDEX IF NOT EXISTS idx_trial_signups_ends_at ON public.trial_signups(trial_ends_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_signups_sub ON public.trial_signups(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE public.trial_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_trial_signups" ON public.trial_signups
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins_read_trial_signups" ON public.trial_signups
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users_read_own_trial_signups" ON public.trial_signups
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Drip touch tracking
CREATE TABLE IF NOT EXISTS public.trial_drip_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trial_signup_id UUID NOT NULL REFERENCES public.trial_signups(id) ON DELETE CASCADE,
  touch_key TEXT NOT NULL, -- day3 | day5 | day6 | day8 | day14
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_drip_touch ON public.trial_drip_state(trial_signup_id, touch_key);
CREATE INDEX IF NOT EXISTS idx_trial_drip_signup ON public.trial_drip_state(trial_signup_id);

ALTER TABLE public.trial_drip_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_trial_drip" ON public.trial_drip_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins_read_trial_drip" ON public.trial_drip_state
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_trial_signups_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_trial_signups_updated_at ON public.trial_signups;
CREATE TRIGGER trg_trial_signups_updated_at
  BEFORE UPDATE ON public.trial_signups
  FOR EACH ROW EXECUTE FUNCTION public.touch_trial_signups_updated_at();