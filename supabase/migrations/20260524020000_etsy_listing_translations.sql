-- etsy_listing_translations — tracks which listings have been translated to which languages.
-- Prevents duplicate translation API calls within 30 days.

CREATE TABLE IF NOT EXISTS etsy_listing_translations (
  id            bigserial PRIMARY KEY,
  listing_id    text NOT NULL,
  language      text NOT NULL,  -- 'de', 'fr', 'es'
  translated_at timestamptz DEFAULT now(),
  UNIQUE (listing_id, language)
);

CREATE INDEX IF NOT EXISTS etsy_listing_translations_listing_idx ON etsy_listing_translations (listing_id);
