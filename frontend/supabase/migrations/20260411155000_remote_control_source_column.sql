-- Add source column to remote_control_log to track where commands originate (phone, n8n, api, etc.)
ALTER TABLE public.remote_control_log ADD COLUMN IF NOT EXISTS source text DEFAULT 'api';
