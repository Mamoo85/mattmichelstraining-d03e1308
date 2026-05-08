CREATE TABLE IF NOT EXISTS public.lead_credit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product text NOT NULL,
  lead_id text NOT NULL,
  lead_table text,
  requester_email text NOT NULL,
  requester_user_id uuid,
  reason_code text NOT NULL,
  reason_detail text,
  status text NOT NULL DEFAULT 'pending',
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_credit_requests_status ON public.lead_credit_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_credit_requests_lead ON public.lead_credit_requests (product, lead_id);

ALTER TABLE public.lead_credit_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lcr_service_all ON public.lead_credit_requests;
CREATE POLICY lcr_service_all ON public.lead_credit_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS lcr_auth_insert ON public.lead_credit_requests;
CREATE POLICY lcr_auth_insert ON public.lead_credit_requests
  FOR INSERT TO authenticated WITH CHECK (
    requester_user_id = auth.uid() OR requester_user_id IS NULL
  );

DROP POLICY IF EXISTS lcr_auth_select_own ON public.lead_credit_requests;
CREATE POLICY lcr_auth_select_own ON public.lead_credit_requests
  FOR SELECT TO authenticated USING (
    requester_user_id = auth.uid()
    OR requester_email = (auth.jwt() ->> 'email')
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS lcr_admin_update ON public.lead_credit_requests;
CREATE POLICY lcr_admin_update ON public.lead_credit_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
