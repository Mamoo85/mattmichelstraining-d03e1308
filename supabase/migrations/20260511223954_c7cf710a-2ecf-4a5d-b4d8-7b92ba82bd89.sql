-- Email open/click tracking columns for Resend webhook
ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS complained_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_email_send_log_message_id ON public.email_send_log(message_id);

-- Marketplace prospects (target table for find-lo-prospects NMLS importer)
CREATE TABLE IF NOT EXISTS public.marketplace_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nmls_id text UNIQUE,
  full_name text,
  company text,
  city text,
  state text DEFAULT 'MI',
  phone text,
  email text,
  website text,
  source text NOT NULL DEFAULT 'nmls_seed',
  fetched_at timestamptz DEFAULT now(),
  enriched_at timestamptz,
  notes text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_marketplace_prospects" ON public.marketplace_prospects;
CREATE POLICY "admin_read_marketplace_prospects"
  ON public.marketplace_prospects FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "service_role_all_marketplace_prospects" ON public.marketplace_prospects;
CREATE POLICY "service_role_all_marketplace_prospects"
  ON public.marketplace_prospects FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_marketplace_prospects_company ON public.marketplace_prospects(company);
CREATE INDEX IF NOT EXISTS idx_marketplace_prospects_state ON public.marketplace_prospects(state);

-- Force PostgREST schema cache reload (clears the "Could not query schema cache" toast)
NOTIFY pgrst, 'reload schema';