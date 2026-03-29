-- ── SECURITY FIXES ──────────────────────────────────────────────────────────
-- Addresses 5 issues flagged by Lovable security scanner:
-- 1. form-check-videos bucket public + any-user read → private + scoped
-- 2. Realtime channels unrestricted → table RLS enforced properly
-- 3. email_send_log missing admin READ policy → added
-- 4. Stripe IDs exposed on business tables with no RLS → admin/service only
-- 5. form-check-videos public bucket → same as #1

-- ── 1 & 5: form-check-videos — make bucket private, restrict reads ──────────
UPDATE storage.buckets SET public = false WHERE id = 'form-check-videos';

DROP POLICY IF EXISTS "Anyone can view form check videos" ON storage.objects;

DO $$ BEGIN
  CREATE POLICY "Users can view own form check videos" ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'form-check-videos' AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2: Realtime — enforce REPLICA IDENTITY FULL so RLS filters changes ───────
-- Supabase Postgres Changes respect table RLS; FULL identity ensures
-- the filter can evaluate the row's user_id on DELETE as well.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.program_messages REPLICA IDENTITY FULL;

-- ── 3: email_send_log — add admin read policy ────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Admins can read send log"
    ON public.email_send_log FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4: Business tables with Stripe IDs — lock down to admin + service role ───

-- seo_package_orders
ALTER TABLE IF EXISTS public.seo_package_orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage seo_package_orders"
    ON public.seo_package_orders FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can manage seo_package_orders"
    ON public.seo_package_orders FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- audit_report_orders
ALTER TABLE IF EXISTS public.audit_report_orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage audit_report_orders"
    ON public.audit_report_orders FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can manage audit_report_orders"
    ON public.audit_report_orders FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- gbp_management_clients
ALTER TABLE IF EXISTS public.gbp_management_clients ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage gbp_management_clients"
    ON public.gbp_management_clients FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can manage gbp_management_clients"
    ON public.gbp_management_clients FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- camp_directory_listings
ALTER TABLE IF EXISTS public.camp_directory_listings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage camp_directory_listings"
    ON public.camp_directory_listings FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can manage camp_directory_listings"
    ON public.camp_directory_listings FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- contractor_clients (from four_businesses migration)
ALTER TABLE IF EXISTS public.contractor_clients ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage contractor_clients"
    ON public.contractor_clients FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can manage contractor_clients"
    ON public.contractor_clients FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- b2b_subscribers
ALTER TABLE IF EXISTS public.b2b_subscribers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage b2b_subscribers"
    ON public.b2b_subscribers FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can manage b2b_subscribers"
    ON public.b2b_subscribers FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- gbp_saas_clients
ALTER TABLE IF EXISTS public.gbp_saas_clients ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage gbp_saas_clients"
    ON public.gbp_saas_clients FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can manage gbp_saas_clients"
    ON public.gbp_saas_clients FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- web_design_leads (has stripe_charge_id, stripe_subscription_id)
ALTER TABLE IF EXISTS public.web_design_leads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage web_design_leads"
    ON public.web_design_leads FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can manage web_design_leads"
    ON public.web_design_leads FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
