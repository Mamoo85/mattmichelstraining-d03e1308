-- eBay integration tables
-- Phase 79: eBay order fulfillment + sold-spy pipeline

-- Order fulfillment log
CREATE TABLE IF NOT EXISTS ebay_orders (
  id                  BIGSERIAL PRIMARY KEY,
  ebay_order_id       TEXT NOT NULL UNIQUE,
  ebay_item_id        TEXT,
  queue_id            INTEGER,
  digital_listing_id  INTEGER,
  kdp_book_id         INTEGER,
  order_type          TEXT NOT NULL DEFAULT 'unknown', -- physical | digital | book | unknown
  buyer_username      TEXT,
  buyer_email         TEXT,
  shipping_name       TEXT,
  shipping_address    JSONB,
  sale_price_cents    INTEGER,
  printify_order_id   TEXT,
  fulfilled_at        TIMESTAMPTZ,
  download_sent_at    TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'pending', -- pending | fulfilled
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ebay_orders_order_id ON ebay_orders(ebay_order_id);
CREATE INDEX IF NOT EXISTS idx_ebay_orders_status   ON ebay_orders(status);
CREATE INDEX IF NOT EXISTS idx_ebay_orders_item_id  ON ebay_orders(ebay_item_id);

-- Account deletion webhook log (eBay compliance requirement)
CREATE TABLE IF NOT EXISTS ebay_deletion_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT,
  payload     JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- pg_cron: eBay order fulfiller every 30 min
SELECT cron.unschedule('ebay-order-fulfiller-30m')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ebay-order-fulfiller-30m');

SELECT cron.schedule(
  'ebay-order-fulfiller-30m',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ebay-order-fulfiller',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' ||
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT') ||
      '"}'::jsonb,
    body := '{"mode":"check"}'::jsonb
  );
  $$
);

-- pg_cron: eBay sold spy daily at 6am UTC
SELECT cron.unschedule('ebay-sold-spy-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ebay-sold-spy-daily');

SELECT cron.schedule(
  'ebay-sold-spy-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/ebay-sold-spy',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' ||
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT') ||
      '"}'::jsonb,
    body := '{"mode":"auto","limit":10}'::jsonb
  );
  $$
);
