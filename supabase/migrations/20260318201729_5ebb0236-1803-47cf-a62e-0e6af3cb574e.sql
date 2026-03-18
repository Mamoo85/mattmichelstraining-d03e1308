
-- Family subscription items: maps each family member to their Stripe subscription item
CREATE TABLE public.family_subscription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL,
  member_user_id UUID NOT NULL,
  stripe_subscription_id TEXT NOT NULL,
  stripe_subscription_item_id TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'basic',
  price_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_user_id, member_user_id)
);

ALTER TABLE public.family_subscription_items ENABLE ROW LEVEL SECURITY;

-- Parents can read their own family items
CREATE POLICY "Parents can view own family items"
  ON public.family_subscription_items
  FOR SELECT
  TO authenticated
  USING (parent_user_id = auth.uid() OR member_user_id = auth.uid());

-- Only edge functions (service role) can insert/update/delete
CREATE POLICY "Service role manages family items"
  ON public.family_subscription_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
