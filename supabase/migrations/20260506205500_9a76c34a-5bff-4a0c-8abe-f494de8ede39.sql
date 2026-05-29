
-- Trial notification dedup + funnel events + unified admin view

ALTER TABLE public.radar_trials
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

ALTER TABLE public.trial_signups
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.trial_funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  product text,
  email text,
  session_id text,
  utm jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  user_agent text,
  referrer text,
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_trial_funnel_events_type_time
  ON public.trial_funnel_events (event_type, created_at desc);
CREATE INDEX IF NOT EXISTS idx_trial_funnel_events_product
  ON public.trial_funnel_events (product, created_at desc);
CREATE INDEX IF NOT EXISTS idx_trial_funnel_events_email
  ON public.trial_funnel_events (lower(email)) WHERE email IS NOT NULL;

ALTER TABLE public.trial_funnel_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_trial_funnel_events" ON public.trial_funnel_events;
CREATE POLICY "service_role_all_trial_funnel_events"
  ON public.trial_funnel_events FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_trial_funnel_events" ON public.trial_funnel_events;
CREATE POLICY "anon_insert_trial_funnel_events"
  ON public.trial_funnel_events FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "auth_insert_trial_funnel_events" ON public.trial_funnel_events;
CREATE POLICY "auth_insert_trial_funnel_events"
  ON public.trial_funnel_events FOR INSERT TO authenticated WITH CHECK (true);

-- Unified admin view: union of no-CC magic-link trials + Stripe trials
CREATE OR REPLACE VIEW public.admin_all_trials
WITH (security_invoker = true)
AS
SELECT
  'radar_trials'::text                    AS source_table,
  rt.id::text                             AS source_id,
  rt.email                                AS email,
  rt.phone                                AS phone,
  rt.product                              AS product,
  rt.status                               AS status,
  rt.created_at                           AS started_at,
  rt.expires_at                           AS expires_at,
  NULL::timestamptz                       AS converted_at,
  rt.source                               AS source,
  rt.notified_at                          AS notified_at,
  rt.business_name                        AS business_name,
  COALESCE(rt.metadata, '{}'::jsonb)      AS metadata
FROM public.radar_trials rt
UNION ALL
SELECT
  'trial_signups'::text                   AS source_table,
  ts.id::text                             AS source_id,
  ts.email                                AS email,
  ts.phone                                AS phone,
  ts.product_key                          AS product,
  ts.status                               AS status,
  ts.trial_started_at                     AS started_at,
  ts.trial_ends_at                        AS expires_at,
  ts.converted_at                         AS converted_at,
  COALESCE(ts.utm->>'utm_source','stripe')AS source,
  ts.notified_at                          AS notified_at,
  NULL::text                              AS business_name,
  COALESCE(ts.utm, '{}'::jsonb)           AS metadata
FROM public.trial_signups ts;
