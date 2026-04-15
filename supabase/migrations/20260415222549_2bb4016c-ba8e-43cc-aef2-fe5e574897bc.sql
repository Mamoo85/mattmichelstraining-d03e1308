-- Add dispatch_token for secure dispatcher access
ALTER TABLE public.field_crm_clients
ADD COLUMN IF NOT EXISTS dispatch_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');

-- Backfill existing rows that might have NULL
UPDATE public.field_crm_clients
SET dispatch_token = encode(gen_random_bytes(16), 'hex')
WHERE dispatch_token IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE public.field_crm_clients
ALTER COLUMN dispatch_token SET NOT NULL;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_field_crm_clients_dispatch_token
ON public.field_crm_clients (dispatch_token);