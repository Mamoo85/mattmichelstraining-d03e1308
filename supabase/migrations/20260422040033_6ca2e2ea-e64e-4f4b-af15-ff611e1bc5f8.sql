
-- 1. Unlocks/purchases table
CREATE TABLE IF NOT EXISTS public.industrial_pulse_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('snapshot_50','firehose_199')),
  stripe_session_id TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  amount_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','canceled','refunded')),
  week_start DATE,
  unlocked_signal_ids UUID[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ipu_email ON public.industrial_pulse_unlocks(email);
CREATE INDEX IF NOT EXISTS idx_ipu_session ON public.industrial_pulse_unlocks(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_ipu_status ON public.industrial_pulse_unlocks(status);

ALTER TABLE public.industrial_pulse_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_ipu" ON public.industrial_pulse_unlocks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Weekly cron — Tuesday 11:00 UTC = 7am ET (DST-agnostic; close enough for a digest)
DO $$
DECLARE
  v_supabase_url TEXT;
  v_service_key  TEXT;
BEGIN
  SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_service_key  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    RAISE NOTICE 'Skipping cron: vault secrets missing (will be wired on next vault sync)';
    RETURN;
  END IF;

  -- Drop existing if present
  PERFORM cron.unschedule('industrial-pulse-weekly-tuesday')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'industrial-pulse-weekly-tuesday');

  PERFORM cron.schedule(
    'industrial-pulse-weekly-tuesday',
    '0 11 * * 2',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{"trigger":"cron"}'::jsonb
      );
    $cron$,
    v_supabase_url || '/functions/v1/industrial-pulse-weekly',
    json_build_object('Content-Type','application/json','Authorization','Bearer '||v_service_key)::text
    )
  );
END $$;
