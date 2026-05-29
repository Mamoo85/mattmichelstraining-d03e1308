CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  stripe_charge_id text,
  stripe_subscription_id text,
  amount integer NOT NULL DEFAULT 0,
  item_name text NOT NULL DEFAULT '',
  item_type text NOT NULL DEFAULT 'subscription',
  status text NOT NULL DEFAULT 'completed',
  customer_email text,
  customer_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all transactions"
  ON public.transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage transactions"
  ON public.transactions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);