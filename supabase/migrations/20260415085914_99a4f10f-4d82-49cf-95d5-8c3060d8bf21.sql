-- Add estimated duration for scheduling conflict detection
ALTER TABLE public.field_service_jobs
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer DEFAULT 60;

-- Add signature URL for digital signature capture on completion
ALTER TABLE public.field_service_jobs
  ADD COLUMN IF NOT EXISTS signature_url text;

-- Add customer contact phone for completion SMS (separate from customer table)
ALTER TABLE public.field_service_jobs
  ADD COLUMN IF NOT EXISTS customer_contact_phone text;

-- Enable realtime for field_service_jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.field_service_jobs;