
CREATE TABLE IF NOT EXISTS public.radar_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  product text NOT NULL CHECK (product IN ('mortgage_radar','techalert','site_radar','contractor_leads','missed_call','industry_pulse','fielddesk','bundle_revenue_suite')),
  magic_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','converted','expired','founder','revoked')),
  source text,
  ip_address text,
  user_agent text,
  business_name text,
  phone text,
  city text,
  state text DEFAULT 'MI',
  zip_codes text[],
  metadata jsonb DEFAULT '{}'::jsonb,
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  converted_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, product)
);

CREATE INDEX IF NOT EXISTS idx_radar_trials_email ON public.radar_trials (lower(email));
CREATE INDEX IF NOT EXISTS idx_radar_trials_product ON public.radar_trials (product);
CREATE INDEX IF NOT EXISTS idx_radar_trials_token ON public.radar_trials (magic_token);
CREATE INDEX IF NOT EXISTS idx_radar_trials_expires ON public.radar_trials (expires_at) WHERE status = 'active';

ALTER TABLE public.radar_trials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_radar_trials"
  ON public.radar_trials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_radar_trials_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_radar_trials_updated_at ON public.radar_trials;
CREATE TRIGGER trg_radar_trials_updated_at
  BEFORE UPDATE ON public.radar_trials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_radar_trials_updated_at();
