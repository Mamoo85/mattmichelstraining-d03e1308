-- Phase 78: Fix broken pod-bestseller-expander-weekly cron (was url := NULL)
-- and add missing etsy-digital-competitor-scout weekly cron

-- 1. Fix pod-bestseller-expander-weekly (had url := NULL, Bearer NULL — silent no-op)
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'pod-bestseller-expander-weekly';
SELECT cron.schedule(
  'pod-bestseller-expander-weekly',
  '0 9 * * 3',
  'SELECT net.http_post(url:=''https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/pod-bestseller-expander'',headers:=''{"Content-Type":"application/json"}''::jsonb,body:=''{"expand":true,"topN":10}''::jsonb)'
);

-- 2. Add etsy-digital-competitor-scout weekly cron (Mondays 8am UTC)
-- Discovers top-selling competitor digital products, queues up to 10 new ideas per run
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'etsy-digital-competitor-scout-weekly';
SELECT cron.schedule(
  'etsy-digital-competitor-scout-weekly',
  '0 8 * * 1',
  'SELECT net.http_post(url:=''https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/etsy-digital-competitor-scout'',headers:=''{"Content-Type":"application/json"}''::jsonb,body:=''{}''::jsonb)'
);
