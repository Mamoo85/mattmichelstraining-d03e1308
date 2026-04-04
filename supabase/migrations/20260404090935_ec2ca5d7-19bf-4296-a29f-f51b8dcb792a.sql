
ALTER TABLE public.trademark_watch_clients ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE public.podcast_clients ADD COLUMN IF NOT EXISTS customer_email text;
UPDATE public.trademark_watch_clients SET customer_email = email WHERE customer_email IS NULL;
UPDATE public.podcast_clients SET customer_email = email WHERE customer_email IS NULL;
