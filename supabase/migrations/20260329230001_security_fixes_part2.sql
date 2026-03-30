-- ── SECURITY FIXES PART 2 ───────────────────────────────────────────────────

-- ── 1: form_checks bucket — make private ────────────────────────────────────
UPDATE storage.buckets SET public = false WHERE id = 'form_checks';

-- ── 2: Realtime REPLICA IDENTITY FULL (only if tables exist) ────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    ALTER TABLE public.notifications REPLICA IDENTITY FULL;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'program_messages') THEN
    ALTER TABLE public.program_messages REPLICA IDENTITY FULL;
  END IF;
END $$;

-- ── 3: Safe views — strip Stripe IDs from client-accessible tables ───────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.subscriptions_safe AS
      SELECT id, user_id, status, plan, current_period_start, current_period_end, created_at, updated_at
      FROM public.subscriptions';
    EXECUTE 'GRANT SELECT ON public.subscriptions_safe TO authenticated';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.transactions_safe AS
      SELECT id, user_id, amount, item_name, item_type, status, customer_email, created_at
      FROM public.transactions';
    EXECUTE 'GRANT SELECT ON public.transactions_safe TO authenticated';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'family_subscription_items') THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.family_subscription_items_safe AS
      SELECT id, parent_user_id, member_user_id, tier, created_at, updated_at
      FROM public.family_subscription_items';
    EXECUTE 'GRANT SELECT ON public.family_subscription_items_safe TO authenticated';
  END IF;
END $$;
