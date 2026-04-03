-- Government Contract Opportunity Monitor tables

-- Clients who subscribe to the gov contract monitoring service
CREATE TABLE public.gov_contract_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email text NOT NULL,
  customer_name text,
  company_name text,
  naics_codes text,
  keywords text,
  set_aside_types text,
  min_contract_value bigint,
  max_contract_value bigint,
  preferred_states text,
  stripe_subscription_id text,
  subscription_status text NOT NULL DEFAULT 'active',
  last_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gov_contract_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gov_contract_clients"
  ON public.gov_contract_clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own gov_contract_clients"
  ON public.gov_contract_clients FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to gov_contract_clients"
  ON public.gov_contract_clients FOR ALL
  USING (auth.role() = 'service_role');

-- Matched opportunities found for each client
CREATE TABLE public.gov_contract_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.gov_contract_clients(id) ON DELETE CASCADE,
  sam_notice_id text NOT NULL,
  title text,
  agency text,
  naics_code text,
  set_aside text,
  response_deadline timestamptz,
  posted_date timestamptz,
  sam_url text,
  match_score int,
  bid_recommendation text,
  ai_summary text,
  sent_to_client boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, sam_notice_id)
);

ALTER TABLE public.gov_contract_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own gov_contract_opportunities"
  ON public.gov_contract_opportunities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.gov_contract_clients gcc
      WHERE gcc.id = gov_contract_opportunities.client_id
        AND gcc.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to gov_contract_opportunities"
  ON public.gov_contract_opportunities FOR ALL
  USING (auth.role() = 'service_role');
