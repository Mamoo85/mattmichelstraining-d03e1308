-- ── SECURITY: RLS GAPS FOUND BY AUDIT ────────────────────────────────────────
-- Fixes 3 categories of vulnerabilities:
-- 1. 5 tables with no RLS at all (b2b_contacts, contractor_lead_sites, etc.)
-- 2. user_roles missing INSERT/UPDATE/DELETE deny policies (privilege escalation)
-- 3. service_subscriptions missing user-facing SELECT policy

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLES WITH NO RLS — enable + admin/service_role only
-- ─────────────────────────────────────────────────────────────────────────────

-- b2b_contacts (lead generation data — internal only)
ALTER TABLE IF EXISTS public.b2b_contacts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage b2b_contacts"
    ON public.b2b_contacts FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can manage b2b_contacts"
    ON public.b2b_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- contractor_lead_sites
ALTER TABLE IF EXISTS public.contractor_lead_sites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage contractor_lead_sites"
    ON public.contractor_lead_sites FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can manage contractor_lead_sites"
    ON public.contractor_lead_sites FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- contractor_leads
ALTER TABLE IF EXISTS public.contractor_leads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage contractor_leads"
    ON public.contractor_leads FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can manage contractor_leads"
    ON public.contractor_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- newsletter_subscribers
ALTER TABLE IF EXISTS public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage newsletter_subscribers"
    ON public.newsletter_subscribers FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can manage newsletter_subscribers"
    ON public.newsletter_subscribers FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- newsletter_sends
ALTER TABLE IF EXISTS public.newsletter_sends ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins can manage newsletter_sends"
    ON public.newsletter_sends FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service role can manage newsletter_sends"
    ON public.newsletter_sends FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. user_roles — explicit deny policies to close privilege escalation window
--    (RLS denies by default when no matching policy, but explicit is safer
--     and prevents future developer confusion)
-- ─────────────────────────────────────────────────────────────────────────────

-- Only admins can INSERT new roles (assigns roles via edge function / admin UI)
DO $$ BEGIN
  CREATE POLICY "Only admins can insert user_roles"
    ON public.user_roles FOR INSERT TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Only admins can UPDATE roles (prevents self-escalation)
DO $$ BEGIN
  CREATE POLICY "Only admins can update user_roles"
    ON public.user_roles FOR UPDATE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Only admins can DELETE roles
DO $$ BEGIN
  CREATE POLICY "Only admins can delete user_roles"
    ON public.user_roles FOR DELETE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role retains full access
DO $$ BEGIN
  CREATE POLICY "Service role can manage user_roles"
    ON public.user_roles FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. service_subscriptions — add user-facing SELECT so clients can read
--    their own subscription status (needed for gating checks)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Users can view their own service_subscriptions"
    ON public.service_subscriptions FOR SELECT TO authenticated
    USING (email = (
      SELECT email FROM auth.users WHERE id = auth.uid() LIMIT 1
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
