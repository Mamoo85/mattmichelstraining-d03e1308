-- Free Dossier request flow: capture work emails, log issued previews, track upgrades.
CREATE TABLE IF NOT EXISTS public.free_dossier_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  company TEXT,
  signal_id UUID,
  signal_company TEXT,
  status TEXT NOT NULL DEFAULT 'preview_sent',
  source TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  upgraded_at TIMESTAMPTZ,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_free_dossier_email ON public.free_dossier_requests(email);
CREATE INDEX IF NOT EXISTS idx_free_dossier_created ON public.free_dossier_requests(created_at DESC);

ALTER TABLE public.free_dossier_requests ENABLE ROW LEVEL SECURITY;

-- Service role full access (edge functions only)
CREATE POLICY "Service role full access to free_dossier_requests"
  ON public.free_dossier_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Admins can read for the admin panel
CREATE POLICY "Admins can read free_dossier_requests"
  ON public.free_dossier_requests
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));