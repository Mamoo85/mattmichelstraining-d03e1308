
-- Admin-configurable trial & support settings (singleton row)
CREATE TABLE public.trial_settings (
  id integer PRIMARY KEY DEFAULT 1,
  trial_days integer NOT NULL DEFAULT 14,
  auto_charge_tier text NOT NULL DEFAULT 'basic',
  early_cancel_discount_pct integer NOT NULL DEFAULT 50,
  auto_renew_default boolean NOT NULL DEFAULT true,
  tech_support_auto_reply text NOT NULL DEFAULT 'Thanks for reaching out! We received your message and will get back to you within 24 hours. If this is urgent, please email matthewmichels4@gmail.com directly.',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Seed default row
INSERT INTO public.trial_settings (id) VALUES (1);

-- RLS
ALTER TABLE public.trial_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read settings
CREATE POLICY "Anyone can read trial settings"
  ON public.trial_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can update
CREATE POLICY "Admins can update trial settings"
  ON public.trial_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
