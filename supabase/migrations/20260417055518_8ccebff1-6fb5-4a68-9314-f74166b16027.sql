
-- ── BUILD 1: TechAlert Prospect Hunter ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.techalert_prospect_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  website text,
  email text,
  phone text,
  city text,
  state text DEFAULT 'MI',
  role text,
  days_posted integer,
  repost_count integer DEFAULT 0,
  open_roles_count integer DEFAULT 1,
  is_boiler boolean DEFAULT false,
  score integer DEFAULT 0,
  source_url text,
  source_label text,
  status text NOT NULL DEFAULT 'new',
  notes text,
  last_contacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_techalert_prospect_targets_status_score
  ON public.techalert_prospect_targets (status, score DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_techalert_prospect_targets_company_role
  ON public.techalert_prospect_targets (lower(company_name), lower(coalesce(role,'')));

ALTER TABLE public.techalert_prospect_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_techalert_prospect_targets" ON public.techalert_prospect_targets;
CREATE POLICY "service_role_all_techalert_prospect_targets"
  ON public.techalert_prospect_targets
  AS PERMISSIVE FOR ALL TO public
  USING (false) WITH CHECK (false);

DROP TRIGGER IF EXISTS update_techalert_prospect_targets_updated_at ON public.techalert_prospect_targets;
CREATE TRIGGER update_techalert_prospect_targets_updated_at
  BEFORE UPDATE ON public.techalert_prospect_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── BUILD 2: Missed Call self-serve setup token ─────────────────────────
ALTER TABLE public.missed_call_clients
  ADD COLUMN IF NOT EXISTS setup_token uuid DEFAULT gen_random_uuid();

UPDATE public.missed_call_clients SET setup_token = gen_random_uuid() WHERE setup_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_missed_call_clients_setup_token
  ON public.missed_call_clients (setup_token);

-- ── Cron: techalert prospect hunter daily 6am ET (10 UTC) ──────────────
DO $$
DECLARE
  supabase_url text;
  service_key text;
BEGIN
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
    PERFORM cron.unschedule('techalert-prospect-hunter-daily') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'techalert-prospect-hunter-daily'
    );
    PERFORM cron.schedule(
      'techalert-prospect-hunter-daily',
      '0 10 * * *',
      format($job$
        SELECT net.http_post(
          url := %L,
          headers := %L::jsonb,
          body := '{"trigger":"cron"}'::jsonb
        );
      $job$, supabase_url || '/functions/v1/techalert-prospect-hunter',
             jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || service_key)::text)
    );
  END IF;
END $$;
