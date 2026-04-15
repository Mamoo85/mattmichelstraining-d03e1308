
ALTER TABLE public.contractor_leads ADD COLUMN IF NOT EXISTS is_demo_record boolean DEFAULT false;
ALTER TABLE public.hire_alert_candidates ADD COLUMN IF NOT EXISTS is_demo_record boolean DEFAULT false;
ALTER TABLE public.dead_lead_contacts ADD COLUMN IF NOT EXISTS is_demo_record boolean DEFAULT false;
ALTER TABLE public.dead_lead_campaigns ADD COLUMN IF NOT EXISTS is_demo_record boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_contractor_leads_demo ON public.contractor_leads (is_demo_record) WHERE is_demo_record = true;
CREATE INDEX IF NOT EXISTS idx_hire_alert_candidates_demo ON public.hire_alert_candidates (is_demo_record) WHERE is_demo_record = true;
CREATE INDEX IF NOT EXISTS idx_dead_lead_contacts_demo ON public.dead_lead_contacts (is_demo_record) WHERE is_demo_record = true;
CREATE INDEX IF NOT EXISTS idx_dead_lead_campaigns_demo ON public.dead_lead_campaigns (is_demo_record) WHERE is_demo_record = true;
