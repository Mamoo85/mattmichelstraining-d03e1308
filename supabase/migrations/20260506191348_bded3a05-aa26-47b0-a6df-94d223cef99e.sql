-- Demo bookings: who booked, when, what type
CREATE TABLE IF NOT EXISTS public.demo_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_email text NOT NULL,
  prospect_name text,
  company text,
  phone text,
  website text,
  slot_date date NOT NULL,
  slot_time text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Detroit',
  demo_type text NOT NULL DEFAULT 'discovery_15' CHECK (demo_type IN ('discovery_15','full_30')),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','rescheduled','cancelled','completed','no_show')),
  notes text,
  source text,
  prospect_token text UNIQUE,
  calendar_event_id text,
  prep_email_sent_at timestamptz,
  matt_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.demo_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_demo_bookings" ON public.demo_bookings
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "admins_read_demo_bookings" ON public.demo_bookings
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_demo_bookings_email ON public.demo_bookings(prospect_email);
CREATE INDEX IF NOT EXISTS idx_demo_bookings_slot ON public.demo_bookings(slot_date, slot_time);

-- Prospect research dossier: cached enrichment + scrape data per prospect
CREATE TABLE IF NOT EXISTS public.prospect_research_dossier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  company text,
  website text,
  industry text,
  service_summary text,
  team_signals text,
  current_site_grade text,
  recommended_products jsonb DEFAULT '[]'::jsonb,
  talking_points jsonb DEFAULT '[]'::jsonb,
  raw jsonb DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email)
);
ALTER TABLE public.prospect_research_dossier ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_dossier" ON public.prospect_research_dossier
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "admins_read_dossier" ON public.prospect_research_dossier
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));