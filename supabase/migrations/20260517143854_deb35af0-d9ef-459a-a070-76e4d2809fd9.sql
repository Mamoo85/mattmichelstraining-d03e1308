
ALTER TABLE public.pod_listings
  ADD COLUMN IF NOT EXISTS seo_optimized_at timestamptz,
  ADD COLUMN IF NOT EXISTS seo_baseline jsonb;

-- Backfill: mark all currently existing listings as optimized "now"
-- and capture their latest stat snapshot as the baseline (zeros if none).
WITH latest AS (
  SELECT DISTINCT ON (listing_id)
    listing_id, views, num_favorers, sales_count, revenue_cents, snapshot_date
  FROM public.pod_listing_stats
  ORDER BY listing_id, snapshot_date DESC
)
UPDATE public.pod_listings p
SET
  seo_optimized_at = COALESCE(p.seo_optimized_at, now()),
  seo_baseline = COALESCE(
    p.seo_baseline,
    jsonb_build_object(
      'views', COALESCE(l.views, 0),
      'favorites', COALESCE(l.num_favorers, 0),
      'sales', COALESCE(l.sales_count, 0),
      'revenue_cents', COALESCE(l.revenue_cents, 0),
      'captured_at', now()
    )
  )
FROM (SELECT id FROM public.pod_listings) ids
LEFT JOIN latest l ON l.listing_id = ids.id
WHERE p.id = ids.id;
