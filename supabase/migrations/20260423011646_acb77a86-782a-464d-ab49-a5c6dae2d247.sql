CREATE TABLE IF NOT EXISTS public.buyer_radar_custom_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  target_accounts INTEGER,
  geographic_radius TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brcr_status ON public.buyer_radar_custom_requests(status, created_at DESC);

ALTER TABLE public.buyer_radar_custom_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access brcr"
  ON public.buyer_radar_custom_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "admins can view brcr"
  ON public.buyer_radar_custom_requests
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can update brcr"
  ON public.buyer_radar_custom_requests
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_brcr_updated_at
  BEFORE UPDATE ON public.buyer_radar_custom_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();