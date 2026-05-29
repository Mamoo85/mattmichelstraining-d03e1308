
DROP POLICY "Trainer read" ON public.outreach_leads;
DROP POLICY "Trainer insert" ON public.outreach_leads;
DROP POLICY "Trainer update" ON public.outreach_leads;
DROP POLICY "Trainer delete" ON public.outreach_leads;

CREATE POLICY "Admin read" ON public.outreach_leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin insert" ON public.outreach_leads FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update" ON public.outreach_leads FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete" ON public.outreach_leads FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
