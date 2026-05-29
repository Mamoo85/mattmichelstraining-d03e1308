-- YouTube OAuth tokens
CREATE TABLE IF NOT EXISTS youtube_oauth_tokens (
  id bigint generated always as identity primary key,
  channel_id text unique not null,
  channel_title text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  updated_at timestamptz default now()
);

-- YouTube Shorts upload log
CREATE TABLE IF NOT EXISTS youtube_shorts (
  id bigint generated always as identity primary key,
  etsy_listing_id text,
  youtube_video_id text unique not null,
  title text,
  status text default 'published',
  created_at timestamptz default now()
);

-- Add cron for youtube-shorts-uploader at 3pm UTC daily
SELECT cron.unschedule('youtube-shorts-uploader') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'youtube-shorts-uploader'
);
SELECT cron.schedule(
  'youtube-shorts-uploader',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/youtube-shorts-uploader',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
