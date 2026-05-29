-- AI Corporation tables: spending approvals, Gumroad digital products,
-- Shopify sync log, daily P&L — plus crons for all 4 corporate agents.

-- ── spending_approvals ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spending_approvals (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent                 text        NOT NULL,
  decision_type         text        NOT NULL,   -- 'ad_campaign' | 'new_service' | 'infrastructure'
  description           text        NOT NULL,
  projected_cost_cents  int         NOT NULL DEFAULT 0,
  projected_revenue_cents int       NOT NULL DEFAULT 0,
  status                text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending','approved','denied')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  decided_at            timestamptz
);
CREATE INDEX IF NOT EXISTS spending_approvals_status_idx ON spending_approvals(status);

-- ── gumroad_digital_products ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gumroad_digital_products (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type       text        NOT NULL,   -- 'template_pack' | 'guide' | 'content_pack' | 'prompt_library'
  title              text        NOT NULL,
  niche              text,
  gumroad_product_id text,
  gumroad_url        text,
  price_cents        int         NOT NULL DEFAULT 997,
  file_path          text,
  status             text        NOT NULL DEFAULT 'creating'
                                 CHECK (status IN ('creating','live','failed')),
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gumroad_digital_products_status_idx ON gumroad_digital_products(status);

-- ── shopify_sync_log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shopify_sync_log (
  id           bigserial   PRIMARY KEY,
  action_type  text        NOT NULL,   -- 'collection_created' | 'description_updated' | 'blog_post_created'
  shopify_id   text,
  details      jsonb       NOT NULL DEFAULT '{}',
  status       text        NOT NULL DEFAULT 'ok',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── corp_daily_pnl ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS corp_daily_pnl (
  id             bigserial   PRIMARY KEY,
  date           date        NOT NULL,
  channel        text        NOT NULL,   -- 'gumroad' | 'shopify' | 'etsy' | 'fiverr' | 'kdp' | 'agency'
  revenue_cents  int         NOT NULL DEFAULT 0,
  cost_cents     int         NOT NULL DEFAULT 0,
  order_count    int         NOT NULL DEFAULT 0,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(date, channel)
);

-- ── crons ─────────────────────────────────────────────────────────────────────
DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT';
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'vault key missing'; END IF;

  -- CFO daily report — 6am UTC
  PERFORM cron.unschedule('cfo-daily-report')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cfo-daily-report');
  PERFORM cron.schedule(
    'cfo-daily-report',
    '0 6 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/cfo-daily-report',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text)
  );

  -- Gumroad digital creator — daily 2pm UTC (researches + creates 1 product/day autonomously)
  PERFORM cron.unschedule('gumroad-digital-creator')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gumroad-digital-creator');
  PERFORM cron.schedule(
    'gumroad-digital-creator',
    '0 14 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/gumroad-digital-creator',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text)
  );

  -- Shopify store agent — daily 1pm UTC
  PERFORM cron.unschedule('shopify-store-agent')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'shopify-store-agent');
  PERFORM cron.schedule(
    'shopify-store-agent',
    '0 13 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/shopify-store-agent',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text)
  );

  -- Store marketing agent — daily 11am UTC
  PERFORM cron.unschedule('store-marketing-agent')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'store-marketing-agent');
  PERFORM cron.schedule(
    'store-marketing-agent',
    '0 11 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/store-marketing-agent',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text)
  );

  -- Fiverr meta-agent — Mondays 8am UTC (weekly briefing)
  PERFORM cron.unschedule('fiverr-meta-agent-weekly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fiverr-meta-agent-weekly');
  PERFORM cron.schedule(
    'fiverr-meta-agent-weekly',
    '0 8 * * 1',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/fiverr-meta-agent',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text)
  );

END $migration$;
