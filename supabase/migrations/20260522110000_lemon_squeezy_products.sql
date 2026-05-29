-- lemon_squeezy_products: tracks which Gumroad products have been synced to Lemon Squeezy
CREATE TABLE IF NOT EXISTS lemon_squeezy_products (
  id                  BIGSERIAL PRIMARY KEY,
  gumroad_product_id  TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  ls_product_id       TEXT NOT NULL,
  ls_buy_url          TEXT,
  price_eur_cents     INT NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lemon_squeezy_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON lemon_squeezy_products
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Cron: daily 4pm UTC
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'lemon-squeezy-sync-daily';
SELECT cron.schedule(
  'lemon-squeezy-sync-daily',
  '0 16 * * *',
  'SELECT net.http_post(url:=''https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/lemon-squeezy-sync'',headers:=''{"Content-Type":"application/json"}''::jsonb,body:=''{}''::jsonb)'
);
