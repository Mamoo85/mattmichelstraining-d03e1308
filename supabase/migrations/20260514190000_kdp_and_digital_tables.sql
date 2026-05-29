-- KDP low-content book queue (word search, journals)
CREATE TABLE IF NOT EXISTS kdp_books (
  id          bigserial PRIMARY KEY,
  niche       text NOT NULL,
  title       text,
  description text,
  keywords    text[],
  file_path   text,
  page_count  int DEFAULT 30,
  book_type   text DEFAULT 'word_search', -- word_search | journal | puzzle
  status      text DEFAULT 'generating',  -- generating | ready | uploaded | live
  asin        text,
  created_at  timestamptz DEFAULT now()
);

-- Etsy digital download listings (printable art, SVG quotes)
CREATE TABLE IF NOT EXISTS etsy_digital_listings (
  id               bigserial PRIMARY KEY,
  title            text,
  niche            text,
  etsy_listing_id  text,
  file_path        text,
  price_cents      int DEFAULT 299,
  status           text DEFAULT 'draft', -- draft | active | failed
  created_at       timestamptz DEFAULT now()
);

-- Pinterest pins for POD products and digital listings
CREATE TABLE IF NOT EXISTS pinterest_pins (
  id           bigserial PRIMARY KEY,
  source_type  text,    -- pod_listing | digital_listing
  source_id    bigint,
  pin_id       text,
  board_id     text,
  created_at   timestamptz DEFAULT now()
);
