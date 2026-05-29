-- heygen_youtube_retry_cron
-- Retries YouTube upload for all heygen_jobs in 'rendered' state (clips stored in Supabase
-- Storage but not yet on YouTube). Fires at 08:15 UTC daily — 15 minutes after the YouTube
-- Data API daily quota resets at midnight Pacific (08:00 UTC).
--
-- Default YouTube upload quota: 6 videos/day (10,000 units / 1,600 per upload).
-- The retry function stops on first quota error, so it never burns the new day's quota
-- on re-upload attempts before fresh content is queued.
--
-- YouTube trap: quota_limit = "defaultVideoInsertPerDayPerProject" (6/day).
-- To increase: Google Cloud Console → IAM & Admin → Quotas → youtube.googleapis.com/video_insert
-- See MASTER_MEMORY Category 42 for full diagnosis and retry commands.

SELECT cron.unschedule('heygen-youtube-retry-daily');
SELECT cron.schedule(
  'heygen-youtube-retry-daily',
  '15 8 * * *',
  $$SELECT net.http_post(
    url:='https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/heygen-youtube-retry',
    headers:='{"Content-Type":"application/json"}'::jsonb,
    body:='{"retryRendered":true}'::jsonb
  )$$
);
