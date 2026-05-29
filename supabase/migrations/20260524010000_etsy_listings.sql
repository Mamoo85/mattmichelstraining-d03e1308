-- etsy_listings — synced copy of active Etsy shop listings (secondary POD project)
-- Populated by etsy-listing-sync function (daily 6am UTC).
-- Read by GNG storefront at /gifts and /gng.

CREATE TABLE IF NOT EXISTS etsy_listings (
  listing_id        text PRIMARY KEY,
  title             text NOT NULL DEFAULT '',
  description       text DEFAULT '',
  price_usd         numeric(8, 2) DEFAULT 0,
  listing_url       text DEFAULT '',
  main_image        text,
  tags              text[] DEFAULT '{}',
  num_favorers      int DEFAULT 0,
  status            text DEFAULT 'active',
  created_timestamp bigint,
  ending_tsz        bigint,
  synced_at         timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS etsy_listings_status_idx  ON etsy_listings (status);
CREATE INDEX IF NOT EXISTS etsy_listings_favorers_idx ON etsy_listings (num_favorers DESC);
CREATE INDEX IF NOT EXISTS etsy_listings_created_idx  ON etsy_listings (created_timestamp DESC);
