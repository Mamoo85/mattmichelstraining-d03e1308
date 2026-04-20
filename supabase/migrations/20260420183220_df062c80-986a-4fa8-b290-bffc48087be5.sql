-- Ad launch drafts: pre-built ad creative sitting ready for one-click launch
CREATE TABLE IF NOT EXISTS public.ad_launch_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid REFERENCES public.contractor_clients(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  trade text NOT NULL,
  city text NOT NULL,
  state text DEFAULT 'MI',
  -- Meta (Facebook + Instagram)
  meta_headline text,
  meta_primary_text text,
  meta_description text,
  meta_image_prompt text,
  meta_image_url text,
  meta_targeting jsonb,
  meta_daily_budget_cents integer DEFAULT 2000,
  meta_status text DEFAULT 'draft', -- draft | launched | failed | manual
  meta_campaign_id text,
  meta_launched_at timestamptz,
  meta_launch_error text,
  -- Google Ads (manual / paste-ready)
  google_headlines text[],
  google_descriptions text[],
  google_keywords text[],
  google_status text DEFAULT 'draft', -- draft | copied | manual
  -- Common
  landing_url text,
  utm_params text,
  status text NOT NULL DEFAULT 'pending_review', -- pending_review | launched | dismissed
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  notes text
);

ALTER TABLE public.ad_launch_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access ad_launch_drafts"
  ON public.ad_launch_drafts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins read ad_launch_drafts"
  ON public.ad_launch_drafts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins update ad_launch_drafts"
  ON public.ad_launch_drafts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_ad_launch_drafts_status ON public.ad_launch_drafts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_launch_drafts_contractor ON public.ad_launch_drafts(contractor_id);