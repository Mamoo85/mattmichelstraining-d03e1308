-- Marketing Kill Switch (single-row config)
CREATE TABLE IF NOT EXISTS public.marketing_kill_switch (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  toggled_by TEXT,
  toggled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO public.marketing_kill_switch (id, enabled) VALUES (1, false) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.marketing_kill_switch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role bypass kill switch" ON public.marketing_kill_switch
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read kill switch" ON public.marketing_kill_switch
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update kill switch" ON public.marketing_kill_switch
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Pitch Send Audit Log
CREATE TABLE IF NOT EXISTS public.pitch_send_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  triggered_by TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pitch_audit_recipient ON public.pitch_send_audit(recipient_email);
CREATE INDEX IF NOT EXISTS idx_pitch_audit_created ON public.pitch_send_audit(created_at DESC);
ALTER TABLE public.pitch_send_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role bypass pitch audit" ON public.pitch_send_audit
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin read pitch audit" ON public.pitch_send_audit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Command Center Tiles (personal tab grid)
CREATE TABLE IF NOT EXISTS public.command_center_tiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL DEFAULT 'matt@detroitwebagent.com',
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  icon_emoji TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_status TEXT,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_tiles_owner_sort ON public.command_center_tiles(owner_email, sort_order);
ALTER TABLE public.command_center_tiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role bypass cc tiles" ON public.command_center_tiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin all cc tiles" ON public.command_center_tiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));