ALTER TABLE public.outreach_leads
  ADD COLUMN IF NOT EXISTS teaser_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS teaser_magic_url text,
  ADD COLUMN IF NOT EXISTS teaser_replied_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_outreach_leads_teaser_sent ON public.outreach_leads(teaser_sent_at) WHERE teaser_sent_at IS NULL;