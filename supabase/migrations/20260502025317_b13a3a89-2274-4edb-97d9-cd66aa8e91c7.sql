
CREATE TABLE IF NOT EXISTS public.outreach_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text,
  owner_first_name text,
  owner_last_name text,
  owner_title text,
  email text,
  phone text,
  fax text,
  address_line1 text,
  city text,
  state text,
  zip text,
  vertical text NOT NULL,
  source text,
  source_url text,
  enrichment_data jsonb DEFAULT '{}'::jsonb,
  is_founder boolean NOT NULL DEFAULT false,
  is_dnc boolean NOT NULL DEFAULT false,
  do_not_email boolean NOT NULL DEFAULT false,
  do_not_fax boolean NOT NULL DEFAULT false,
  do_not_mail boolean NOT NULL DEFAULT false,
  last_contacted_at timestamptz,
  contact_count int NOT NULL DEFAULT 0,
  reply_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_outreach_targets_email ON public.outreach_targets (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_outreach_targets_phone ON public.outreach_targets (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outreach_targets_vertical_state ON public.outreach_targets (vertical, state);
CREATE INDEX IF NOT EXISTS idx_outreach_targets_last_contacted ON public.outreach_targets (last_contacted_at);

ALTER TABLE public.outreach_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_outreach_targets" ON public.outreach_targets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email','fax','postcard','sms')),
  product text NOT NULL,
  verticals text[] NOT NULL DEFAULT '{}',
  states text[] NOT NULL DEFAULT '{MI}',
  cities text[],
  template_subject text,
  template_body text NOT NULL,
  cta_url text,
  daily_send_cap int NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','archived')),
  total_targets int NOT NULL DEFAULT 0,
  total_sent int NOT NULL DEFAULT 0,
  total_replied int NOT NULL DEFAULT 0,
  total_bounced int NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_status ON public.outreach_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_channel ON public.outreach_campaigns (channel);

ALTER TABLE public.outreach_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_outreach_campaigns" ON public.outreach_campaigns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.outreach_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.outreach_targets(id) ON DELETE CASCADE,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','opened','clicked','replied','bounced','failed','suppressed')),
  provider text,
  provider_message_id text,
  recipient_email text,
  recipient_phone text,
  recipient_fax text,
  recipient_address text,
  cost_cents int,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  bounced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, target_id)
);
CREATE INDEX IF NOT EXISTS idx_outreach_sends_campaign ON public.outreach_sends (campaign_id);
CREATE INDEX IF NOT EXISTS idx_outreach_sends_target ON public.outreach_sends (target_id);
CREATE INDEX IF NOT EXISTS idx_outreach_sends_status ON public.outreach_sends (status);
CREATE INDEX IF NOT EXISTS idx_outreach_sends_sent_at ON public.outreach_sends (sent_at);

ALTER TABLE public.outreach_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_outreach_sends" ON public.outreach_sends
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_outreach_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_outreach_targets_upd ON public.outreach_targets;
CREATE TRIGGER trg_outreach_targets_upd BEFORE UPDATE ON public.outreach_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_outreach_updated_at();

DROP TRIGGER IF EXISTS trg_outreach_campaigns_upd ON public.outreach_campaigns;
CREATE TRIGGER trg_outreach_campaigns_upd BEFORE UPDATE ON public.outreach_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_outreach_updated_at();

DROP TRIGGER IF EXISTS trg_outreach_sends_upd ON public.outreach_sends;
CREATE TRIGGER trg_outreach_sends_upd BEFORE UPDATE ON public.outreach_sends
  FOR EACH ROW EXECUTE FUNCTION public.update_outreach_updated_at();
