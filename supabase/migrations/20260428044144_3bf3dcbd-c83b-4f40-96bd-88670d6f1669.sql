
-- =====================================================
-- Sprint B: Outreach Send Queue, Bounce & Reply Tracking
-- =====================================================

-- 1. Send Queue table (background job queue)
CREATE TABLE IF NOT EXISTS public.outreach_send_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('email','sms')),
  prospect_id uuid REFERENCES public.contractor_outreach_prospects(id) ON DELETE CASCADE,
  lead_id uuid,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','claimed','sent','failed','dead')),
  attempts smallint NOT NULL DEFAULT 0,
  max_attempts smallint NOT NULL DEFAULT 3,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  claimed_by text,
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority smallint NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_send_queue_claim
  ON public.outreach_send_queue (status, scheduled_for, priority DESC)
  WHERE status IN ('queued','claimed');

CREATE INDEX IF NOT EXISTS idx_send_queue_prospect
  ON public.outreach_send_queue (prospect_id, channel, created_at DESC);

ALTER TABLE public.outreach_send_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access send_queue"
  ON public.outreach_send_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins read send_queue"
  ON public.outreach_send_queue FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_send_queue_updated_at
  BEFORE UPDATE ON public.outreach_send_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Replies table
CREATE TABLE IF NOT EXISTS public.outreach_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid REFERENCES public.contractor_outreach_prospects(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email','sms')),
  from_address text NOT NULL,
  subject text,
  body text,
  sentiment text CHECK (sentiment IN ('positive','negative','neutral','unsubscribe','auto_reply')),
  handled boolean NOT NULL DEFAULT false,
  handled_at timestamptz,
  handled_by uuid,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_replies_unhandled
  ON public.outreach_replies (handled, created_at DESC) WHERE handled = false;
CREATE INDEX IF NOT EXISTS idx_replies_prospect
  ON public.outreach_replies (prospect_id, created_at DESC);

ALTER TABLE public.outreach_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access replies"
  ON public.outreach_replies FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admins manage replies"
  ON public.outreach_replies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Add bounce tracking to prospects
ALTER TABLE public.contractor_outreach_prospects
  ADD COLUMN IF NOT EXISTS bounce_count smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hard_bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_bounce_reason text;

-- 4. Expand audit log allowed events (drop & recreate check constraint)
ALTER TABLE public.contractor_outreach_audit_log
  DROP CONSTRAINT IF EXISTS contractor_outreach_audit_log_event_check;
ALTER TABLE public.contractor_outreach_audit_log
  ADD CONSTRAINT contractor_outreach_audit_log_event_check CHECK (
    event = ANY (ARRAY[
      'sent','opened','clicked','replied','unsubscribed','suppressed',
      'consent_granted','consent_revoked','quiet_hours_blocked','daily_cap_blocked',
      'bounce','complaint','queued','retry','dead'
    ])
  );

-- 5. RPC: atomically claim N send jobs
CREATE OR REPLACE FUNCTION public.claim_outreach_send_jobs(
  p_worker_id text,
  p_batch_size int DEFAULT 10
) RETURNS SETOF public.outreach_send_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id FROM public.outreach_send_queue
    WHERE status = 'queued'
      AND scheduled_for <= now()
    ORDER BY priority DESC, scheduled_for ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.outreach_send_queue q
     SET status = 'claimed',
         claimed_by = p_worker_id,
         claimed_at = now(),
         attempts = q.attempts + 1
    FROM claimed
   WHERE q.id = claimed.id
  RETURNING q.*;
END;
$$;

-- 6. RPC: mark job result with exponential backoff
CREATE OR REPLACE FUNCTION public.mark_outreach_send_result(
  p_job_id uuid,
  p_success boolean,
  p_error_msg text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.outreach_send_queue;
  v_backoff_minutes int;
BEGIN
  SELECT * INTO v_job FROM public.outreach_send_queue WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_success THEN
    UPDATE public.outreach_send_queue
       SET status = 'sent', sent_at = now(), last_error = NULL
     WHERE id = p_job_id;
  ELSE
    IF v_job.attempts >= v_job.max_attempts THEN
      UPDATE public.outreach_send_queue
         SET status = 'dead', last_error = p_error_msg
       WHERE id = p_job_id;
    ELSE
      -- Exponential backoff: 2, 8, 32 minutes
      v_backoff_minutes := power(4, v_job.attempts)::int * 2;
      UPDATE public.outreach_send_queue
         SET status = 'queued',
             scheduled_for = now() + (v_backoff_minutes || ' minutes')::interval,
             last_error = p_error_msg,
             claimed_by = NULL,
             claimed_at = NULL
       WHERE id = p_job_id;
    END IF;
  END IF;
END;
$$;

-- 7. RPC: handle email bounce (hard or soft)
CREATE OR REPLACE FUNCTION public.handle_email_bounce(
  p_email text,
  p_bounce_type text,  -- 'hard' or 'soft'
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prospect_id uuid;
BEGIN
  SELECT id INTO v_prospect_id
    FROM public.contractor_outreach_prospects
   WHERE lower(email) = lower(p_email)
   LIMIT 1;

  IF v_prospect_id IS NULL THEN RETURN; END IF;

  UPDATE public.contractor_outreach_prospects
     SET bounce_count = bounce_count + 1,
         last_bounce_reason = p_reason,
         hard_bounced_at = CASE
           WHEN p_bounce_type = 'hard' THEN now()
           WHEN bounce_count + 1 >= 3 THEN now()
           ELSE hard_bounced_at
         END,
         unsubscribed_at = CASE
           WHEN p_bounce_type = 'hard' OR bounce_count + 1 >= 3 THEN now()
           ELSE unsubscribed_at
         END
   WHERE id = v_prospect_id;

  -- Add to suppression if hard bounce
  IF p_bounce_type = 'hard' THEN
    INSERT INTO public.contractor_outreach_suppression (contact, contact_type, source, reason)
    VALUES (lower(p_email), 'email', 'bounce', p_reason)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.contractor_outreach_audit_log (prospect_id, channel, event, reason, metadata)
  VALUES (v_prospect_id, 'email', 'bounce', p_reason, jsonb_build_object('bounce_type', p_bounce_type));
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_outreach_send_jobs(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_outreach_send_result(uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_email_bounce(text, text, text) TO service_role;
