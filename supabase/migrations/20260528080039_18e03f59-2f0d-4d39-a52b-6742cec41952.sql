-- T1.2: Block anon INSERT on trial_funnel_events
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='trial_funnel_events') THEN
    ALTER TABLE public.trial_funnel_events ENABLE ROW LEVEL SECURITY;
    -- Drop any existing permissive anon policies
    DROP POLICY IF EXISTS "anon can insert trial events" ON public.trial_funnel_events;
    DROP POLICY IF EXISTS "Anyone can insert trial events" ON public.trial_funnel_events;
    DROP POLICY IF EXISTS no_anon_insert ON public.trial_funnel_events;
    -- Hard-block anon inserts
    CREATE POLICY no_anon_insert ON public.trial_funnel_events
      FOR INSERT TO anon WITH CHECK (false);
    -- Revoke table-level INSERT grant from anon as belt-and-suspenders
    REVOKE INSERT ON public.trial_funnel_events FROM anon;
  END IF;
END $$;