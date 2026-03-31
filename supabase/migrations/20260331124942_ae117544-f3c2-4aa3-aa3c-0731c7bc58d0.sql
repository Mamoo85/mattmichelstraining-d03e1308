
ALTER TABLE public.web_design_leads ADD COLUMN IF NOT EXISTS monthly_retainer BOOLEAN DEFAULT false;
ALTER TABLE public.web_design_leads ADD COLUMN IF NOT EXISTS site_url TEXT;
