
-- Fix 1: Add admin-only SELECT policy to call_summaries
CREATE POLICY "Admins can read call_summaries"
ON public.call_summaries
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fix 3: Add encrypted columns for CMS credentials
ALTER TABLE public.blog_post_clients
  ADD COLUMN IF NOT EXISTS cms_username_enc bytea,
  ADD COLUMN IF NOT EXISTS cms_app_password_enc bytea;
