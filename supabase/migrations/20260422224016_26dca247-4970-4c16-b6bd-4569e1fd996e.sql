ALTER TABLE public.prospect_nudges
  ADD COLUMN IF NOT EXISTS generated_by_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_prospect_nudges_generated_by_admin
  ON public.prospect_nudges (generated_by_admin, created_at DESC)
  WHERE generated_by_admin = true;

CREATE INDEX IF NOT EXISTS idx_prospect_nudges_expires_at
  ON public.prospect_nudges (expires_at)
  WHERE expires_at IS NOT NULL;