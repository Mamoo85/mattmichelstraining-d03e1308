-- Restore anon/authenticated INSERT grants on funnel + unsub tables.
-- RLS policies allow it (WITH CHECK true), but PostgREST also requires a Postgres GRANT.

GRANT INSERT, SELECT ON public.trial_funnel_events TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE ON public.email_unsubscribe_tokens TO anon, authenticated;

-- If either table uses a sequence (it doesn't — both use uuid defaults), grant usage too defensively:
DO $$
DECLARE
  seq_name text;
BEGIN
  FOR seq_name IN
    SELECT pg_get_serial_sequence('public.trial_funnel_events', column_name)
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='trial_funnel_events'
      AND pg_get_serial_sequence('public.trial_funnel_events', column_name) IS NOT NULL
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO anon, authenticated', seq_name);
  END LOOP;
END $$;
