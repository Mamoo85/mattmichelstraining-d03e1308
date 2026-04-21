CREATE TABLE IF NOT EXISTS public.outreach_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text,
  phone text,
  email text,
  domain text,
  reason text NOT NULL,
  source_table text,
  source_agent text,
  blocked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocklist_phone ON public.outreach_blocklist (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blocklist_email ON public.outreach_blocklist (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blocklist_domain ON public.outreach_blocklist (domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blocklist_business ON public.outreach_blocklist (lower(business_name)) WHERE business_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blocklist_blocked_until ON public.outreach_blocklist (blocked_until);

ALTER TABLE public.outreach_blocklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_blocklist" ON public.outreach_blocklist FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admin_read_blocklist" ON public.outreach_blocklist FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_write_blocklist" ON public.outreach_blocklist FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_blocklist" ON public.outreach_blocklist FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_delete_blocklist" ON public.outreach_blocklist FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.extract_domain(input text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
DECLARE d text;
BEGIN
  IF input IS NULL OR length(trim(input)) = 0 THEN RETURN NULL; END IF;
  d := lower(trim(input));
  d := regexp_replace(d, '^https?://', '');
  IF position('@' in d) > 0 THEN d := split_part(d, '@', 2); END IF;
  d := split_part(d, '/', 1);
  d := regexp_replace(d, '^www\.', '');
  RETURN d;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_block_paying_client()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_biz text; v_phone text; v_email text;
  rec_json jsonb;
BEGIN
  rec_json := to_jsonb(NEW);
  v_biz := lower(trim(COALESCE(rec_json->>'business_name', rec_json->>'company_name', rec_json->>'name', '')));
  v_phone := COALESCE(rec_json->>'phone', rec_json->>'owner_phone', '');
  v_email := lower(trim(COALESCE(rec_json->>'email', rec_json->>'owner_email', rec_json->>'notify_email', '')));

  INSERT INTO public.outreach_blocklist (business_name, phone, email, domain, reason, source_table, blocked_until)
  VALUES (
    NULLIF(v_biz, ''), NULLIF(v_phone, ''), NULLIF(v_email, ''),
    NULLIF(public.extract_domain(v_email), ''),
    'paying_client', TG_TABLE_NAME, NULL
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  client_tables text[] := ARRAY['contractor_clients','field_crm_clients','hire_alert_clients','missed_call_clients','staffing_agency_clients'];
BEGIN
  FOREACH t IN ARRAY client_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_auto_block_%I ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER trg_auto_block_%I AFTER INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.auto_block_paying_client()', t, t);
    END IF;
  END LOOP;
END $$;

-- Backfill via to_jsonb to bypass per-table column differences
DO $$
DECLARE
  t text;
  client_tables text[] := ARRAY['contractor_clients','field_crm_clients','hire_alert_clients','missed_call_clients','staffing_agency_clients'];
BEGIN
  FOREACH t IN ARRAY client_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format($f$
        INSERT INTO public.outreach_blocklist (business_name, phone, email, domain, reason, source_table, blocked_until)
        SELECT
          NULLIF(lower(trim(COALESCE(j->>'business_name', j->>'company_name', j->>'name', ''))), ''),
          NULLIF(COALESCE(j->>'phone', j->>'owner_phone', ''), ''),
          NULLIF(lower(trim(COALESCE(j->>'email', j->>'owner_email', j->>'notify_email', ''))), ''),
          NULLIF(public.extract_domain(COALESCE(j->>'email', j->>'owner_email', j->>'notify_email', '')), ''),
          'paying_client', %L, NULL
        FROM (SELECT to_jsonb(c) AS j FROM public.%I c) sub
      $f$, t, t);
    END IF;
  END LOOP;
END $$;

-- Backfill last 90 days of outbound comms
INSERT INTO public.outreach_blocklist (phone, email, reason, source_table, blocked_until)
SELECT DISTINCT
  CASE WHEN s.recipient ~ '^\+?[0-9]+$' THEN s.recipient ELSE NULL END,
  CASE WHEN s.recipient ~ '@' THEN lower(s.recipient) ELSE NULL END,
  'recent_outreach', 'system_comms_log', now() + interval '90 days'
FROM public.system_comms_log s
WHERE s.created_at > now() - interval '90 days' AND s.recipient IS NOT NULL AND s.recipient <> '';

-- Manual block: new Livonia electrician
INSERT INTO public.outreach_blocklist (phone, reason, source_table, blocked_until)
VALUES ('+17346207178', 'manual_client_protection', 'manual', NULL);