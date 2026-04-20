-- Restrict service_role policies to actual service_role only (currently granted to public)
DROP POLICY IF EXISTS service_role_all_search_log ON public.search_query_log;
DROP POLICY IF EXISTS service_role_all_saved_alerts ON public.saved_search_alerts;

-- Ensure RLS is enabled
ALTER TABLE public.search_query_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_search_alerts ENABLE ROW LEVEL SECURITY;

-- Recreate policies restricted to service_role
CREATE POLICY service_role_all_search_log
ON public.search_query_log
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY service_role_all_saved_alerts
ON public.saved_search_alerts
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Admin read access (for dashboards), gated through has_role
CREATE POLICY admin_read_search_log
ON public.search_query_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY admin_all_saved_alerts
ON public.saved_search_alerts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));