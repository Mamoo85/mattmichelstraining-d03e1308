DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.outreach_blocklist'::regclass
      AND polname = 'admins_read_outreach_blocklist'
  ) THEN
    CREATE POLICY "admins_read_outreach_blocklist"
    ON public.outreach_blocklist
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;