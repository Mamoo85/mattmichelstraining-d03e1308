-- ── SECURITY FIXES PART 2 ───────────────────────────────────────────────────

-- ── 1: form_checks bucket — make private ────────────────────────────────────
UPDATE storage.buckets SET public = false WHERE id = 'form_checks';

-- ── 2: Realtime — REPLICA IDENTITY FULL ensures table RLS filters per-user ──
-- Table-level RLS + user-scoped channel names in frontend handle channel security.
-- REPLICA IDENTITY FULL ensures RLS can evaluate user_id on DELETE events too.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.program_messages REPLICA IDENTITY FULL;

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
