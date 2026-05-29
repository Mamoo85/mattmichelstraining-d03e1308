
-- Add agency_admin and client to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agency_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';

-- Add role column to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'client'
  CHECK (role IN ('agency_admin', 'client'));

-- Helper: get agency role for a user (checks tenants first, falls back to user_roles admin)
CREATE OR REPLACE FUNCTION public.get_agency_role(_user_id uuid)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT t.role FROM public.tenants t WHERE t.user_id = _user_id LIMIT 1),
    CASE WHEN public.has_role(_user_id, 'admin') THEN 'agency_admin' ELSE 'client' END
  );
$$;
