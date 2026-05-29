-- Add dashboard_token to hire_alert_clients for magic-link dashboard access
ALTER TABLE public.hire_alert_clients
ADD COLUMN IF NOT EXISTS dashboard_token text DEFAULT encode(gen_random_bytes(16), 'hex');

-- Backfill existing rows that have NULL
UPDATE public.hire_alert_clients
SET dashboard_token = encode(gen_random_bytes(16), 'hex')
WHERE dashboard_token IS NULL;

-- Unique index for token lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_hire_REDACTED
ON public.hire_alert_clients (dashboard_token);