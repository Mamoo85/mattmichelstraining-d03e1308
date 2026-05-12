
-- 1) mortgage_radar_clients: add user_id and backfill
ALTER TABLE public.mortgage_radar_clients
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.mortgage_radar_clients m
SET user_id = u.id
FROM auth.users u
WHERE m.user_id IS NULL
  AND m.email IS NOT NULL
  AND lower(u.email) = lower(m.email);

CREATE INDEX IF NOT EXISTS mortgage_radar_clients_user_id_idx
  ON public.mortgage_radar_clients(user_id);

-- 2) Replace mortgage_radar_lead_actions write policy to use auth.uid()
DROP POLICY IF EXISTS client_rw_mortgage_lead_actions ON public.mortgage_radar_lead_actions;

CREATE POLICY client_rw_mortgage_lead_actions
  ON public.mortgage_radar_lead_actions
  FOR ALL
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM public.mortgage_radar_clients WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.mortgage_radar_clients WHERE user_id = auth.uid()
    )
  );

-- 3) lead_credit_requests: remove email-claim branch from SELECT policy
DROP POLICY IF EXISTS lcr_auth_select_own ON public.lead_credit_requests;

CREATE POLICY lcr_auth_select_own
  ON public.lead_credit_requests
  FOR SELECT
  TO authenticated
  USING (
    requester_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 4) checkout_receipts: add user_id, backfill, replace policy
ALTER TABLE public.checkout_receipts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.checkout_receipts r
SET user_id = u.id
FROM auth.users u
WHERE r.user_id IS NULL
  AND r.email IS NOT NULL
  AND lower(u.email) = lower(r.email);

CREATE INDEX IF NOT EXISTS checkout_receipts_user_id_idx
  ON public.checkout_receipts(user_id);

DROP POLICY IF EXISTS select_own_receipt_by_email ON public.checkout_receipts;

CREATE POLICY select_own_receipt_by_user
  ON public.checkout_receipts
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );
