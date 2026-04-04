ALTER TABLE public.social_media_clients
  ADD COLUMN IF NOT EXISTS gbp_account_id text,
  ADD COLUMN IF NOT EXISTS gbp_location_id text,
  ADD COLUMN IF NOT EXISTS tiktok_open_id text,
  ADD COLUMN IF NOT EXISTS tiktok_access_token text;