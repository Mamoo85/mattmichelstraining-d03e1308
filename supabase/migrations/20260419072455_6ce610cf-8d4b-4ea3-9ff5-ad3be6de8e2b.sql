-- National market targeting — geo columns on client + candidate tables
ALTER TABLE public.hire_alert_clients
  ADD COLUMN IF NOT EXISTS target_state text DEFAULT 'MI',
  ADD COLUMN IF NOT EXISTS target_metro text DEFAULT 'detroit',
  ADD COLUMN IF NOT EXISTS target_zip_prefixes text[] DEFAULT ARRAY['480','481','482','483'];

ALTER TABLE public.hire_alert_candidates
  ADD COLUMN IF NOT EXISTS state text DEFAULT 'MI',
  ADD COLUMN IF NOT EXISTS metro text;

-- Backfill any nulls to MI defaults so existing pipeline keeps working
UPDATE public.hire_alert_clients SET target_state = 'MI' WHERE target_state IS NULL;
UPDATE public.hire_alert_clients SET target_metro = 'detroit' WHERE target_metro IS NULL;
UPDATE public.hire_alert_candidates SET state = 'MI' WHERE state IS NULL;

CREATE INDEX IF NOT EXISTS idx_hire_REDACTED ON public.hire_alert_clients(target_state);
CREATE INDEX IF NOT EXISTS idx_hire_REDACTED ON public.hire_alert_candidates(state);
CREATE INDEX IF NOT EXISTS idx_hire_REDACTED ON public.hire_alert_candidates(metro);

-- Same on high_volume_buyer_subscribers if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='high_volume_buyer_subscribers') THEN
    EXECUTE 'ALTER TABLE public.high_volume_buyer_subscribers
      ADD COLUMN IF NOT EXISTS target_state text DEFAULT ''MI'',
      ADD COLUMN IF NOT EXISTS target_metro text DEFAULT ''detroit'',
      ADD COLUMN IF NOT EXISTS target_zip_prefixes text[] DEFAULT ARRAY[''480'',''481'',''482'',''483'']';
  END IF;
END $$;