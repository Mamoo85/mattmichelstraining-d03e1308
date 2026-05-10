DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='admins_select_sst' AND tablename='scanner_source_toggles') THEN
    CREATE POLICY "admins_select_sst" ON public.scanner_source_toggles
      FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='admins_write_sst' AND tablename='scanner_source_toggles') THEN
    CREATE POLICY "admins_write_sst" ON public.scanner_source_toggles
      FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_scanner_source_toggles()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_sst ON public.scanner_source_toggles;
CREATE TRIGGER trg_touch_sst BEFORE UPDATE ON public.scanner_source_toggles
  FOR EACH ROW EXECUTE FUNCTION public.touch_scanner_source_toggles();