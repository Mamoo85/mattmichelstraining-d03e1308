CREATE TABLE public.free_generation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_free_generation_log_ip ON public.free_generation_log (ip_address);

ALTER TABLE public.free_generation_log ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed - only accessed via service_role in edge function