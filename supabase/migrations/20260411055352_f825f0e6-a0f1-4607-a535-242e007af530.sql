-- review_blast_log
CREATE POLICY "Admin can insert review_blast_log"
  ON public.review_blast_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update review_blast_log"
  ON public.review_blast_log FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete review_blast_log"
  ON public.review_blast_log FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- tech_locations
CREATE POLICY "Admin can insert tech_locations"
  ON public.tech_locations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update tech_locations"
  ON public.tech_locations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete tech_locations"
  ON public.tech_locations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- field_crm_clients
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'field_crm_clients' AND policyname = 'Admin can insert field_crm_clients') THEN
    EXECUTE 'CREATE POLICY "Admin can insert field_crm_clients" ON public.field_crm_clients FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), ''admin''))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'field_crm_clients' AND policyname = 'Admin can update field_crm_clients') THEN
    EXECUTE 'CREATE POLICY "Admin can update field_crm_clients" ON public.field_crm_clients FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), ''admin''))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'field_crm_clients' AND policyname = 'Admin can delete field_crm_clients') THEN
    EXECUTE 'CREATE POLICY "Admin can delete field_crm_clients" ON public.field_crm_clients FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin''))';
  END IF;
END $$;