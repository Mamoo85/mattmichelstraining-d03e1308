-- Adds source column to heygen_jobs for routing completed videos
-- "dwa_meta_video_ad" → auto-post to Meta Ads instead of YouTube
ALTER TABLE heygen_jobs ADD COLUMN IF NOT EXISTS source text;
