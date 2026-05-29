-- pod_listing_videos: tracks which Etsy listings have had a video uploaded
-- Prevents double-uploads on repeated calls to etsy-listing-video-uploader

CREATE TABLE IF NOT EXISTS pod_listing_videos (
  id              bigserial    PRIMARY KEY,
  etsy_listing_id text         NOT NULL,
  etsy_video_id   text,
  title           text,
  niche           text,
  uploaded_at     timestamptz  NOT NULL DEFAULT now()
);

-- Unique per listing — prevents re-uploading the same listing
CREATE UNIQUE INDEX IF NOT EXISTS pod_listing_videos_listing_idx
  ON pod_listing_videos(etsy_listing_id);
