-- Fix 1: Drop the misconfigured public policy on free_tool_leads and recreate it scoped to service_role
DROP POLICY IF EXISTS "Service role full access on free_tool_leads" ON public.free_tool_leads;

CREATE POLICY "Service role full access on free_tool_leads"
ON public.free_tool_leads
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add admin SELECT policy for free_tool_leads
CREATE POLICY "Admin can read free_tool_leads"
ON public.free_tool_leads
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix 2: Add admin SELECT policy for trademark_watch_clients
CREATE POLICY "Admin can read trademark_watch_clients"
ON public.trademark_watch_clients
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
