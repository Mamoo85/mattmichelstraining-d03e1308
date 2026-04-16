-- 1. outreach_cooldowns (DWA agent anti-collision)
CREATE TABLE IF NOT EXISTS public.outreach_cooldowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_email TEXT NOT NULL,
  last_agent TEXT NOT NULL,
  last_contacted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.outreach_cooldowns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access outreach_cooldowns" ON public.outreach_cooldowns;
CREATE POLICY "Service role full access outreach_cooldowns"
  ON public.outreach_cooldowns FOR ALL TO service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can read outreach_cooldowns" ON public.outreach_cooldowns;
CREATE POLICY "Admins can read outreach_cooldowns"
  ON public.outreach_cooldowns FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_outreach_cooldowns_email ON public.outreach_cooldowns(prospect_email);

-- 2. campaign_copy_variants (DWA A/B testing)
CREATE TABLE IF NOT EXISTS public.campaign_copy_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.dead_lead_campaigns(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL,
  sms_body TEXT NOT NULL,
  selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.campaign_copy_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access campaign_copy_variants" ON public.campaign_copy_variants;
CREATE POLICY "Service role full access campaign_copy_variants"
  ON public.campaign_copy_variants FOR ALL TO service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can read campaign_copy_variants" ON public.campaign_copy_variants;
CREATE POLICY "Admins can read campaign_copy_variants"
  ON public.campaign_copy_variants FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. contractor_lead_views RLS (table exists but had 0 policies)
DROP POLICY IF EXISTS "Service role full access contractor_lead_views" ON public.contractor_lead_views;
CREATE POLICY "Service role full access contractor_lead_views"
  ON public.contractor_lead_views FOR ALL TO service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can read contractor_lead_views" ON public.contractor_lead_views;
CREATE POLICY "Admins can read contractor_lead_views"
  ON public.contractor_lead_views FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. agent_heartbeats status column (already exists in types but ensure default)
ALTER TABLE public.agent_heartbeats
  ALTER COLUMN status SET DEFAULT 'ok';

-- 5. Delete stale heartbeats (haven't run since April 4 — let them re-insert when actually firing)
DELETE FROM public.agent_heartbeats
WHERE agent_name IN ('oz','scarlett','selma','ops','mute','pulse','scout','hype','drill','ref')
  AND last_beat < (now() - interval '7 days');

-- 6. Re-create hire-alert-scanner-daily cron using vault.decrypted_secrets pattern
DO $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
    PERFORM cron.unschedule('hire-alert-scanner-daily') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'hire-alert-scanner-daily'
    );
    PERFORM cron.schedule(
      'hire-alert-scanner-daily',
      '0 11 * * *',
      format($cron$
        SELECT net.http_post(
          url:=%L,
          headers:=%L::jsonb,
          body:='{"trigger":"daily_cron"}'::jsonb
        );
      $cron$,
        supabase_url || '/functions/v1/hire-alert-scanner',
        '{"Content-Type":"application/json","Authorization":"Bearer ' || service_key || '"}'
      )
    );
  END IF;
END $$;