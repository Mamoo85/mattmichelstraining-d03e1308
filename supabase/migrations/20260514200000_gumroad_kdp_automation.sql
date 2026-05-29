-- Add Gumroad tracking columns to kdp_books
ALTER TABLE kdp_books
  ADD COLUMN IF NOT EXISTS gumroad_product_id text,
  ADD COLUMN IF NOT EXISTS gumroad_url text;

-- Update KDP generator cron to run every 3 hours (8x/day) and add Gumroad uploader cron
DO $migration$
DECLARE
  v_url text := 'https://zmyczlfuufhngzovkjdh.supabase.co';
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT';
  IF v_key IS NULL OR LENGTH(v_key) < 100 THEN RAISE EXCEPTION 'vault key missing'; END IF;

  -- KDP book generator: every 3 hours (was once at 11am)
  PERFORM cron.unschedule('kdp-book-generator')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kdp-book-generator');
  PERFORM cron.schedule('kdp-book-generator', '0 */3 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/kdp-book-generator',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text));

  -- Gumroad uploader: 30 minutes past every 3rd hour (picks up newly generated books)
  PERFORM cron.unschedule('gumroad-uploader')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gumroad-uploader');
  PERFORM cron.schedule('gumroad-uploader', '30 */3 * * *',
    format($job$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_url || '/functions/v1/gumroad-uploader',
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_key)::text));

END $migration$;
