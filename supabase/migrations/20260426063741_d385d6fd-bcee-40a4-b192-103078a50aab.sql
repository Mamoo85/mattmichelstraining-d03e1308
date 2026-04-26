ALTER TABLE public.postcard_campaigns
ADD COLUMN IF NOT EXISTS prospect_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

ALTER TABLE public.fax_campaigns
ADD COLUMN IF NOT EXISTS prospect_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

CREATE INDEX IF NOT EXISTS idx_postcard_campaigns_prospect_ids
ON public.postcard_campaigns USING gin (prospect_ids);

CREATE INDEX IF NOT EXISTS idx_fax_campaigns_prospect_ids
ON public.fax_campaigns USING gin (prospect_ids);