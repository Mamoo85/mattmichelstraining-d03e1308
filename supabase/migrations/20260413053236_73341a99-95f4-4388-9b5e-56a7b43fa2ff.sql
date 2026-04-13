-- email_reply_drafts (ghost delay queue)
CREATE TABLE IF NOT EXISTS public.email_reply_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_email text NOT NULL,
  draft_subject text,
  draft_body text NOT NULL,
  category text,
  send_after timestamptz NOT NULL,
  sent boolean DEFAULT false,
  cancelled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.email_reply_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.email_reply_drafts FOR ALL TO service_role USING (true);

-- contact_preference on contractor_leads
ALTER TABLE public.contractor_leads
  ADD COLUMN IF NOT EXISTS contact_preference text NOT NULL DEFAULT 'call';