
-- Add sector intelligence columns to industry_pulse_signals
ALTER TABLE public.industry_pulse_signals ADD COLUMN IF NOT EXISTS signal_type text;
ALTER TABLE public.industry_pulse_signals ADD COLUMN IF NOT EXISTS sector text;
ALTER TABLE public.industry_pulse_signals ADD COLUMN IF NOT EXISTS client_tag text;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_ips_signal_type ON public.industry_pulse_signals (signal_type);
CREATE INDEX IF NOT EXISTS idx_ips_sector ON public.industry_pulse_signals (sector);
CREATE INDEX IF NOT EXISTS idx_ips_client_tag ON public.industry_pulse_signals (client_tag);
CREATE INDEX IF NOT EXISTS idx_ips_detected_at ON public.industry_pulse_signals (detected_at);

-- Cron: boiler-sector-intel daily at 7am ET (11:00 UTC)
SELECT cron.schedule(
  'boiler-sector-intel-daily',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/boiler-sector-intel',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1)
    ),
    body := '{"source":"cron"}'::jsonb
  ) AS request_id;
  $$
);
