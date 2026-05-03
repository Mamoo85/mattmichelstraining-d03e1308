-- 1. Add missing enrichment columns to outreach_leads
ALTER TABLE public.outreach_leads
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS owner_phone TEXT,
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- 2. Partial index for fast "ready to send" pool counts
CREATE INDEX IF NOT EXISTS idx_outreach_leads_ready_to_send
  ON public.outreach_leads (created_at DESC)
  WHERE last_contact_date IS NULL
    AND (owner_email IS NOT NULL OR enriched_email IS NOT NULL OR validated_email IS NOT NULL OR email IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_outreach_leads_unenriched
  ON public.outreach_leads (created_at DESC)
  WHERE enriched_at IS NULL
    AND owner_email IS NULL
    AND enriched_email IS NULL
    AND validated_email IS NULL
    AND email IS NULL;

-- 3. Unified email suppression view (security_invoker so RLS of caller applies)
CREATE OR REPLACE VIEW public.email_suppression_unified
WITH (security_invoker = true)
AS
  -- Manual / bounce / complaint list
  SELECT lower(contact) AS email, source AS reason, 'suppression_list'::text AS origin
    FROM public.contractor_outreach_suppression
    WHERE contact_type = 'email'
  UNION
  -- Contractor prospects who unsubscribed or hard-bounced
  SELECT lower(email) AS email,
         COALESCE(last_bounce_reason, 'unsubscribed') AS reason,
         'contractor_unsub_or_bounce'::text AS origin
    FROM public.contractor_outreach_prospects
    WHERE email IS NOT NULL
      AND (unsubscribed_at IS NOT NULL OR hard_bounced_at IS NOT NULL OR suppressed_at IS NOT NULL);

GRANT SELECT ON public.email_suppression_unified TO authenticated, service_role;

-- 4. Helper function: is this email blocked?
CREATE OR REPLACE FUNCTION public.is_email_suppressed(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.email_suppression_unified
    WHERE email = lower(p_email)
  ) OR EXISTS(
    SELECT 1 FROM public.email_send_log
    WHERE lower(recipient_email) = lower(p_email)
      AND status IN ('bounced','complained','suppressed','dlq')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_email_suppressed(TEXT) TO authenticated, service_role;
