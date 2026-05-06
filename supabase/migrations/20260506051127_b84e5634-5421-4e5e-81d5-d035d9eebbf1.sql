-- Admin RLS for outreach_campaigns (mirrors command_center_tiles pattern)
CREATE POLICY "admin_all_outreach_campaigns"
ON public.outreach_campaigns
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));