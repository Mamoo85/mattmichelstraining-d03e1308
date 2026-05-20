## Goal
Make the public Shop page reflect the live Etsy catalog (shop_id `6311589`), keep OAuth tokens fresh on a schedule, deep-link every Etsy item to a generated product page, finish the in-flight republish run for POD listings still on the old prompt/dims, and add a pre-publish regression check that blocks any image that isn't full-bleed + spec-normalized.

---

## 1. Scheduled Etsy OAuth refresh

Token refresh exists inline in `_shared/etsy-token.ts` (refreshes when <60s left). Add a **proactive** cron so tokens never expire between user requests.

- New edge function `etsy-token-refresh` (verify_jwt=false): calls `getEtsyAuth()` with a forced refresh path (refresh if <12h remaining), updates `etsy_oauth_tokens`, writes a row to a new `etsy_token_refresh_log` table, SMS Matt on failure.
- pg_cron: every 6 hours (uses the hardcoded URL + `SUPABASE_SERVICE_ROLE_KEY_VAULT` pattern per CLAUDE.md).
- Migration: `etsy_token_refresh_log` table (id, ran_at, success, expires_at, error) + cron schedule.

## 2. Etsy product sync (shop_id 6311589)

New tables (migration):
- `etsy_products` — `listing_id bigint pk`, `shop_id`, `title`, `description`, `price_cents`, `currency`, `url`, `state`, `tags text[]`, `materials text[]`, `quantity`, `created_ts`, `updated_ts`, `last_synced_at`, `raw jsonb`.
- `etsy_product_images` — `listing_id`, `image_id`, `rank`, `url_570xN`, `url_fullxfull`, `alt_text`.
- RLS: public SELECT (anon), service_role write.

New edge function `etsy-product-sync` (verify_jwt=false):
- `GET /v3/application/shops/6311589/listings/active` with pagination (limit=100, offset).
- For each listing → upsert into `etsy_products`, fetch `/listings/{id}/images` → upsert `etsy_product_images`.
- Soft-delete: mark `state='removed'` for listing_ids that disappear from active feed.
- pg_cron: every 60 min.

## 3. Shop page wires to live Etsy data + product detail pages

Frontend:
- New `src/components/store/EtsyTab.tsx` — fetches `etsy_products` (Supabase client, anon SELECT), grid of cards: image, title, price, "View" button.
- Add tab "Etsy Shop" to `src/pages/Shop.tsx` `TABS` array.
- New route `/shop/etsy/:listingId` → `src/pages/EtsyProductDetail.tsx`:
  - Loads `etsy_products` + `etsy_product_images` rows.
  - Image carousel, full description (rendered as markdown/plain text), price, materials, tags.
  - Two CTAs: **"Buy on Etsy"** (deep link to `etsy_products.url`) and **"Add to favorites"** (local).
  - `<SEOHead>` with title/description/og:image + JSON-LD `Product` schema.
- Wire route in `src/App.tsx` (lazyRetry).

## 4. Finish the POD republish run

`pod-republish-wrong-dims` already exists and pulls listings whose latest `pod_dimension_audit` is `wrong_dims | wrong_aspect | missing`.

- Add a new function `pod-republish-resume` (or extend existing) that queries `pod_listings` where `republished_at IS NULL` AND `published_at < <prompt cutoff timestamp>` AND status='published', batches in chunks of 10 with concurrency 2, calls the existing republish pipeline.
- One-shot run triggered from admin button + cron daily 04:00 ET until queue is empty (function self-disables when 0 rows match).
- Writes progress to `pod_publish_logs`.

## 5. Pre-publish image regression gate

Currently `validateImageDimensions` runs inside republish, but `pod-etsy-publisher` / `printify-direct-publish` paths can bypass.

- New shared helper `_shared/pod-image-regression.ts`:
  - `assertFullBleedAndSpec(buffer, productType)` →
    1. Decode PNG/JPEG header to get width/height.
    2. Compare against `getPrintSpec(productType)` exact px + aspect (±0.5% tolerance).
    3. Sample 4 edge strips (top/bottom/left/right, 8px deep): for non-transparent specs, fail if >5% of edge pixels are pure white/background → guarantees full-bleed.
    4. For transparent-bg specs, assert alpha>0 coverage across center 80%.
  - Throws `RegressionError` with reason code; all publish entry points must call it before upload to Printify.
- Add new table `pod_image_regression_log` (listing_id, ran_at, pass, reason, width, height, expected_w, expected_h).
- Wire into: `pod-republish-wrong-dims`, `pod-republish-broken`, `pod-etsy-publisher`, `pod-product-orchestrator`, `printify-direct-publish`, `pod-image-rebake`.
- Failing the gate → `notifyMatt` SMS + skip publish, log entry.

---

## Technical details
- All new edge functions: `verify_jwt = false` block in `supabase/config.toml`.
- All migrations follow the vault-key cron pattern from CLAUDE.md.
- SMS via `_shared/twilio.ts` `sendSMS`; emails via `m2Email()` (Shop is M2-branded).
- No changes to the existing `etsy_oauth_tokens` row contract.
- Etsy v3 rate limit: 10 req/s — sync function uses `await sleep(120)` between page fetches.
- Shop page treats Etsy tab as additive; no existing tabs touched.

## Out of scope
- Native checkout (we deep-link to Etsy — they own the cart).
- Editing Etsy listings from the app (already covered by `etsy-shop-update`).
- Re-running already-correct POD listings.