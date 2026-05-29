
ALTER TABLE public.trademark_watch_clients ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.trademark_watch_clients ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.podcast_clients ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.podcast_clients ADD COLUMN IF NOT EXISTS rss_feed_url text;
ALTER TABLE public.podcast_clients ADD COLUMN IF NOT EXISTS podcast_niche text;
ALTER TABLE public.podcast_clients ADD COLUMN IF NOT EXISTS target_audience text;
ALTER TABLE public.podcast_clients ADD COLUMN IF NOT EXISTS tone text;
ALTER TABLE public.podcast_clients ADD COLUMN IF NOT EXISTS last_episode_guid text;
