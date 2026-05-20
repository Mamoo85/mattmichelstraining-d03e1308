
## Goal
Every existing POD product on Printify must have artwork that matches the canonical `PRINT_SPECS` (correct pixel dimensions + correct background mode for the product class). Any future product generation must be physically incapable of publishing with wrong-dimension artwork.

## Current state
- `supabase/functions/_shared/pod-print-spec.ts` already defines canonical specs for all 50 product types (apparel = transparent, mugs = white-centered 30%, full-bleed = opaque edge-to-edge, stickers/decals = die-cut).
- `pod_listings` table has 50 published products (1 of each type, plus extras for tshirt/tote/hoodie/mug).
- The phone-case fix from the last turn is deployed but only covered 2 SKUs. No system-wide audit has been run.

## Plan

### 1. Build a one-shot auditor edge function: `pod-audit-dimensions`
- For every row in `pod_listings`, GET `https://api.printify.com/v1/shops/{shop_id}/products/{printify_id}.json`.
- For each `print_areas[].placeholders[].images[]`, fetch the image metadata from Printify (`/uploads/{id}.json`) to read `width` × `height`.
- Compare against `PRINT_SPECS[product_type]`:
  - dimension mismatch (>2px tolerance on either axis)
  - aspect-ratio mismatch (catches stretched/wrong-orientation art)
  - missing print area for the spec's `position`
- Write results into a new `pod_dimension_audit` table: `listing_id, product_type, expected_w, expected_h, actual_w, actual_h, bg_mode, status (ok|wrong_dims|wrong_aspect|missing|fetch_error), audited_at`.
- Return a JSON summary grouped by status.

### 2. Build the repair function: `pod-republish-wrong-dims`
- Generalize the existing `pod-republish-broken` function (currently phone-case-only) to handle any product type flagged `wrong_dims` / `wrong_aspect` / `missing` by the auditor.
- For each broken listing: regenerate artwork via `buildPrintPrompt` → `gpt-image-1` → `normalizeToSpec` (guarantees exact pixel dims) → re-upload to Printify → PUT product with corrected `print_areas`.
- Idempotent; safe to re-run.

### 3. Lock the standard at publish time
Add a hard gate to `printify-direct-publish` (already partially there) so any future publish must:
1. Call `buildPrintPrompt(prompt, productType)` — no raw prompts allowed.
2. Run output through `normalizeToSpec()` before upload.
3. Call `validateImageDimensions()` on the final base64 — if not within 2px of spec, throw `dim_violation` and refuse to publish.
4. After Printify create, immediately call the same auditor in (1) on the new product. If audit returns anything other than `ok`, delete the just-created product and throw — preventing any broken product from ever existing.

### 4. CI / cron safety net
- Add a daily cron `pod-audit-dimensions-cron` (9am UTC) that runs the auditor over all listings and SMSes Matt via `notifyMatt` if any product drifts to non-ok status (e.g., Printify regenerates placement, blueprint changes, etc.).
- Add a Deno unit test `pod-print-spec.test.ts` asserting every product_type in `POD_CATALOG` has a matching entry in `PRINT_SPECS` so we can never ship a new SKU without a spec.

### 5. Run order (one-time)
1. Migration: create `pod_dimension_audit` table.
2. Deploy `pod-audit-dimensions` + updated `pod-republish-wrong-dims` + updated `printify-direct-publish`.
3. Run auditor → review summary.
4. Run repair on every flagged listing.
5. Re-run auditor → should report 100% ok.
6. Enable daily cron.

## Technical notes
- Printify image dims are available on `/uploads/{id}.json` as `width`/`height` (no need to download bytes).
- `pod_listings.printify_id` is the Printify product id; shop id comes from `PRINTIFY_SHOP_ID` secret.
- `PRINT_SPECS` already covers all 50 live product_types — no gaps.
- The publish-time double-check (step 3.4) is the key durability guarantee: even if the image generator returns wrong dims and `normalizeToSpec` somehow fails, the post-create audit will catch it before customers see it.

## Out of scope
- Changing blueprints/providers (catalog stays as-is).
- Re-pricing or re-titling — purely a dimensional/visual integrity pass.
