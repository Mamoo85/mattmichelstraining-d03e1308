
-- List and drop all public-role policies on system_comms_log
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'system_comms_log' AND schemaname = 'public'
      AND roles::text[] @> ARRAY['public']
  LOOP
    EXECUTE format('DROP POLICY %I ON public.system_comms_log', pol.policyname);
  END LOOP;

  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'contractor_lead_views' AND schemaname = 'public'
      AND roles::text[] @> ARRAY['public']
  LOOP
    EXECUTE format('DROP POLICY %I ON public.contractor_lead_views', pol.policyname);
  END LOOP;
END $$;
