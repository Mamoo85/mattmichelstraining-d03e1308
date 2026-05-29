-- Create a service_role-only function to execute dynamic SQL from edge functions.
-- This enables the admin-migrate edge function to run migrations remotely.
CREATE OR REPLACE FUNCTION public.exec_sql(query TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE query;
END;
$$;

-- Only service_role can call this
REVOKE ALL ON FUNCTION public.exec_sql(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exec_sql(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.exec_sql(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO service_role;

-- Migrations tracking table
CREATE TABLE IF NOT EXISTS public._applied_migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public._applied_migrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON public._applied_migrations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
