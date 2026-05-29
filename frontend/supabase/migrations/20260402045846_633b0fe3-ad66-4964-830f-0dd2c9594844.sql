-- Add CMS auto-publishing fields to blog_post_clients
ALTER TABLE public.blog_post_clients
  ADD COLUMN IF NOT EXISTS cms_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cms_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cms_username text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cms_app_password text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS auto_publish boolean DEFAULT false;