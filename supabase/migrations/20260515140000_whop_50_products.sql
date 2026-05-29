-- whop 50-product store expansion
-- Adds product_type and gumroad_url columns to whop_products
-- Changes cron from weekly to daily at 2pm UTC (3 products/run, fills store in ~17 days)

ALTER TABLE whop_products ADD COLUMN IF NOT EXISTS product_type text DEFAULT 'prompt_library';
ALTER TABLE whop_products ADD COLUMN IF NOT EXISTS gumroad_url text;
ALTER TABLE whop_products ADD COLUMN IF NOT EXISTS published_at timestamptz DEFAULT now();

DO $migration$
DECLARE
  v_url text := 'https://zmyczlfuufhngzovkjdh.supabase.co';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT';
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'vault key missing'; END IF;

  -- Remove old schedule if any
  PERFORM cron.unschedule('whop-product-publisher')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'whop-product-publisher');

  -- Daily at 2pm UTC — 3 products per run fills 50-product store in ~17 days
  PERFORM cron.schedule('whop-product-publisher', '0 14 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/whop-product-publisher',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text));
END $migration$;
