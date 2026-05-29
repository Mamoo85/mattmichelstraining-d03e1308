-- Etsy print-on-demand automation tables + daily cron schedules.
-- Pipeline: etsy-trend-scanner (9am) → pod-design-generator (10am) → pod-publisher (11am)

CREATE TABLE IF NOT EXISTS etsy_pod_trends (
  id           bigserial PRIMARY KEY,
  niche        text NOT NULL,
  listing_id   text,
  title        text NOT NULL,
  tags         text[],
  price_usd    numeric(8,2),
  num_favorers int DEFAULT 0,
  image_url    text,
  processed    boolean DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(listing_id)
);

CREATE TABLE IF NOT EXISTS pod_designs (
  id                 bigserial PRIMARY KEY,
  trend_id           bigint REFERENCES etsy_pod_trends(id),
  niche              text,
  dalle_prompt       text,
  image_url          text,
  printify_image_id  text,
  status             text DEFAULT 'approved',
  created_at         timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pod_listings (
  id                  bigserial PRIMARY KEY,
  design_id           bigint REFERENCES pod_designs(id),
  printify_product_id text,
  etsy_listing_id     text,
  title               text,
  retail_price_cents  int DEFAULT 1999,
  status              text DEFAULT 'published',
  created_at          timestamptz DEFAULT now()
);

-- Cron jobs — same vault pattern as existing crons
DO $migration$
DECLARE
  v_url text := 'https://eauvubfpanpeuxsrqesu.supabase.co';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT';
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'vault key missing'; END IF;

  PERFORM cron.unschedule('etsy-trend-scanner')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'etsy-trend-scanner');
  PERFORM cron.schedule(
    'etsy-trend-scanner',
    '0 9 * * *',
    format(
      $job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/etsy-trend-scanner',
      json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key)::text
    )
  );

  PERFORM cron.unschedule('pod-design-generator')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-design-generator');
  PERFORM cron.schedule(
    'pod-design-generator',
    '0 10 * * *',
    format(
      $job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/pod-design-generator',
      json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key)::text
    )
  );

  PERFORM cron.unschedule('pod-publisher')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pod-publisher');
  PERFORM cron.schedule(
    'pod-publisher',
    '0 11 * * *',
    format(
      $job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/pod-publisher',
      json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key)::text
    )
  );
END $migration$;
