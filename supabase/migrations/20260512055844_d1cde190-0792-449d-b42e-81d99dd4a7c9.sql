
ALTER TABLE public.outreach_leads
  ADD COLUMN IF NOT EXISTS followup_d3_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_outreach_leads_drip_d3
  ON public.outreach_leads (last_contact_date)
  WHERE followup_d3_sent_at IS NULL AND replied_at IS NULL AND last_contact_date IS NOT NULL;

-- Seed the Cold Email Revival campaign for Matt (idempotent)
INSERT INTO public.dead_lead_campaigns (contractor_id, name, trade, status)
SELECT id, 'Cold Email Revival', 'multi', 'active'
FROM public.contractor_clients
WHERE email = 'matt@detroitwebagent.com'
ON CONFLICT DO NOTHING;
