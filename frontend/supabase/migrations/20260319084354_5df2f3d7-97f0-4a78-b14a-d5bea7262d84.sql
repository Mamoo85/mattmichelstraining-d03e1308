
-- Service catalog: source of truth for all business offerings
CREATE TABLE public.service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  exact_price NUMERIC NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI-generated marketing drafts requiring admin approval
CREATE TABLE public.marketing_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  draft_type TEXT NOT NULL DEFAULT 'ad',
  status TEXT NOT NULL DEFAULT 'pending',
  generated_by TEXT NOT NULL DEFAULT 'ai',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_drafts ENABLE ROW LEVEL SECURITY;

-- service_catalog: public read, admin write
CREATE POLICY "Anyone can read active catalog" ON public.service_catalog
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage catalog" ON public.service_catalog
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- marketing_drafts: admin only
CREATE POLICY "Admins can manage drafts" ON public.marketing_drafts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
