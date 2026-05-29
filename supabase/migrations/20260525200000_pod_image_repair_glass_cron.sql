-- Add nightly cron for glass product image repair (shot glasses — bp 787)
-- Shot glasses need a colored/dark opaque background; white shows through clear glass.
-- Runs at 6am UTC (after apparel at 4am, journal at 5am) — well outside Monday lock window.
-- No vault needed: secondary project vault is empty; cron uses no-auth pattern.

DO $$
BEGIN
  -- Remove old job if it exists (safe to re-run)
  PERFORM cron.unschedule('pod-image-repair-glass')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'pod-image-repair-glass'
  );

  PERFORM cron.schedule(
    'pod-image-repair-glass',
    '0 6 * * *',
    $job$
      SELECT net.http_post(
        url     := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/product-image-repair',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body    := '{"page":1,"category":"glass"}'::jsonb
      );
    $job$
  );
END;
$$;
