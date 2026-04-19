-- 1. Create the missing client actions table
CREATE TABLE IF NOT EXISTS public.industry_pulse_client_actions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid NOT NULL REFERENCES public.industry_pulse_clients(id) ON DELETE CASCADE,
  signal_id     uuid NOT NULL,
  company_name  text NOT NULL,
  action        text NOT NULL CHECK (action IN ('contacted', 'won', 'lost', 'passed')),
  deal_value    numeric(10,2) DEFAULT 0,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, signal_id)
);

ALTER TABLE public.industry_pulse_client_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full" ON public.industry_pulse_client_actions;
CREATE POLICY "service_role_full" ON public.industry_pulse_client_actions
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_ipca_client ON public.industry_pulse_client_actions(client_id);
CREATE INDEX IF NOT EXISTS idx_ipca_signal ON public.industry_pulse_client_actions(signal_id);

-- 2. Default signal_type so future writes through the legacy view never land NULL
ALTER TABLE public.industry_pulse_signals
  ALTER COLUMN signal_type SET DEFAULT 'expansion';

-- 3. Backfill the 115 NULL signals so the dashboard can render them
UPDATE public.industry_pulse_signals
   SET signal_type = COALESCE(
     CASE
       WHEN industry ILIKE '%boiler%' OR industry ILIKE '%hvac%' THEN 'hiring'
       WHEN industry ILIKE '%plumb%' THEN 'hiring'
       WHEN industry ILIKE '%cnc%' OR industry ILIKE '%machin%' THEN 'expansion'
       WHEN industry ILIKE '%weld%' THEN 'expansion'
       WHEN industry ILIKE '%electric%' THEN 'hiring'
       ELSE 'expansion'
     END,
     'expansion'
   )
 WHERE signal_type IS NULL;

-- 4. Hot-path indexes for the dashboard query
CREATE INDEX IF NOT EXISTS idx_ips_detected_at ON public.industry_pulse_signals(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_ips_confidence ON public.industry_pulse_signals(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_ipc_token ON public.industry_pulse_clients(dashboard_token) WHERE dashboard_token IS NOT NULL;