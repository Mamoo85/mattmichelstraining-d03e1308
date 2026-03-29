-- ── SECURITY FIXES PART 2 ───────────────────────────────────────────────────
-- Remaining items from full audit:
-- 1. form_checks bucket also needs to be private (part 1 only fixed form-check-videos)
-- 2. Realtime channel authorization policies
-- 3. Safe views for tables that expose Stripe IDs to row-owners

-- ── 1: form_checks bucket — make private ────────────────────────────────────
UPDATE storage.buckets SET public = false WHERE id = 'form_checks';

-- ── 2: Realtime channel authorization ───────────────────────────────────────
-- Supabase Realtime v2 supports RLS on realtime.messages to restrict channel access.
-- Users may only subscribe to channels scoped to their own user ID.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Users can only subscribe to their own DM channel (coach-dm:{user_id})
  CREATE POLICY "Users subscribe to own coaching channel"
    ON realtime.messages FOR SELECT TO authenticated
    USING (realtime.topic() = 'coach-dm:' || auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- Admins can subscribe to any coaching channel
  CREATE POLICY "Admins subscribe to any coaching channel"
    ON realtime.messages FOR SELECT TO authenticated
    USING (
      starts_with(realtime.topic(), 'coach-dm:')
      AND public.has_role(auth.uid(), 'admin'::public.app_role)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- Users can only subscribe to their own notification channel
  CREATE POLICY "Users subscribe to own notification channel"
    ON realtime.messages FOR SELECT TO authenticated
    USING (realtime.topic() = 'user-notifications:' || auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3: Safe views — strip Stripe IDs from client-accessible tables ───────────

-- subscriptions_safe: hides stripe_subscription_id from client queries
CREATE OR REPLACE VIEW public.subscriptions_safe AS
SELECT id, user_id, status, plan, current_period_start, current_period_end, created_at, updated_at
FROM public.subscriptions;

GRANT SELECT ON public.subscriptions_safe TO authenticated;

-- transactions_safe: hides stripe_charge_id and stripe_subscription_id
CREATE OR REPLACE VIEW public.transactions_safe AS
SELECT id, user_id, amount, item_name, item_type, status, customer_email, created_at
FROM public.transactions;

GRANT SELECT ON public.transactions_safe TO authenticated;

-- family_subscription_items_safe: hides stripe_subscription_id and stripe_subscription_item_id
CREATE OR REPLACE VIEW public.family_subscription_items_safe AS
SELECT id, parent_user_id, member_user_id, tier, created_at, updated_at
FROM public.family_subscription_items;

GRANT SELECT ON public.family_subscription_items_safe TO authenticated;
