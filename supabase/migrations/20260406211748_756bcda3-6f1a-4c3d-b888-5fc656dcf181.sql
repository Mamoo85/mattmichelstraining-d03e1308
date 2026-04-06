-- 1. Drop the insecure anonymous insert policy on contractor_leads
DROP POLICY IF EXISTS "anon_insert_leads" ON public.contractor_leads;

-- 2. Drop the overly permissive public read policy on training_programs
DROP POLICY IF EXISTS "public_read_active_programs" ON public.training_programs;

-- 3. Clean up duplicate admin policies on training_programs (keep one ALL policy)
DROP POLICY IF EXISTS "Admins can manage training programs" ON public.training_programs;
DROP POLICY IF EXISTS "Admins can read all training programs" ON public.training_programs;
DROP POLICY IF EXISTS "Admins can delete training programs" ON public.training_programs;

-- The "Admins full access on training_programs" ALL policy remains and covers all operations.
-- Public read access is handled by the training_programs_public security-invoker view.
-- Contractor lead inserts are handled by the contractor-lead-capture edge function via service_role.