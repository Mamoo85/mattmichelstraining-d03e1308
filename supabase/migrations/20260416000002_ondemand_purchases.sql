-- On-demand name pack purchases tracking
CREATE TABLE IF NOT EXISTS public.ondemand_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  company_name text,
  pack text NOT NULL,
  names_requested integer NOT NULL,
  names_delivered integer NOT NULL DEFAULT 0,
  refund_cents integer DEFAULT 0,
  candidate_ids uuid[] DEFAULT '{}',
  county text,
  license_types text[],
  stripe_session_id text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ondemand_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_ondemand_purchases"
  ON public.ondemand_purchases FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "admin_select_ondemand_purchases"
  ON public.ondemand_purchases FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_ondemand_purchases_email ON public.ondemand_purchases (email);
CREATE INDEX idx_ondemand_purchases_created ON public.ondemand_purchases (created_at DESC);
