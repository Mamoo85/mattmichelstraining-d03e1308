-- FieldDesk 100% — add estimated_value + job_token to field_service_jobs
-- estimated_value: for This Month revenue card on dispatch board
-- job_token: for public homeowner-facing job status page

ALTER TABLE public.field_service_jobs
  ADD COLUMN IF NOT EXISTS estimated_value numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS job_token text UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex');

-- Backfill null job_tokens
UPDATE public.field_service_jobs
SET job_token = encode(gen_random_bytes(12), 'hex')
WHERE job_token IS NULL;

ALTER TABLE public.field_service_jobs
  ALTER COLUMN job_token SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_field_service_jobs_token ON public.field_service_jobs(job_token);
