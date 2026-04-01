ALTER TABLE public.social_media_clients
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS fb_page_id text,
  ADD COLUMN IF NOT EXISTS linkedin_org_id text,
  ADD COLUMN IF NOT EXISTS access_tokens jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_post_at timestamptz;