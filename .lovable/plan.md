## Goal
Publish one Printify/Etsy listing for every product category visible in the screenshots (~40 types), each in a distinct trending niche, with designs that fit the correct print area for that product type.

---

## Critical blocker found during exploration

The existing pipeline only supports **4 product types**: `mug`, `tshirt`, `hoodie`, `tote`.

Evidence:
- `supabase/functions/_shared/pod-preflight.ts` only has description-match and price rules for those four (`desc_missing_mug_mention`, `desc_missing_shirt_mention`, etc.).
- `pod-product-orchestrator` forwards `product.type` verbatim to `printify-product-creator` (which lives on the secondary Supabase project `zmyczlfuufhngzovkjdh`). That downstream function has a hard-coded blueprint / print-provider / variant / print-area map keyed by those same 4 type strings.
- The trends table is `etsy_trend_runs` (jsonb `trend_signals` per niche), not `etsy_pod_trends`.

So before we can publish a candle, phone case, mouse pad, blanket, sticker, etc., we have to teach both functions about those types. This is the main work of this plan.

---

## Plan

### Phase 1 — Catalog mapping (one-time setup)

Build a single source of truth for every Printify product type we want to support. Lives in a new shared module `supabase/functions/_shared/pod-product-catalog.ts`:

```text
type           blueprint_id   provider_id   default_variant_ids   print_area (px)   bg_requirement   retail_price_cents   desc_keywords
mug            <id>           <id>          [...]                 2700 x 1050       white bg         1899                 mug, cup, ceramic
tshirt         ...            ...           ...                   4500 x 5400       transparent     2299                  shirt, tee
hoodie         ...            ...           ...                   4500 x 5400       transparent     3899                  hoodie, sweatshirt
tote           ...            ...           ...                   4000 x 4000       transparent     2099                  tote, bag, canvas
candle         ...            ...           ...                   2475 x 825 wrap   white bg         2499                 candle, soy, scent
phone_case     ...            ...           ...                   1860 x 3840 full  full bleed       2199                 case, phone, iphone
mouse_pad      ...            ...           ...                   2362 x 2362       full bleed       1599                 mouse pad, desk
sticker        ...            ...           ...                   1500 x 1500       transparent     499                   sticker, decal, vinyl
poster         ...            ...           ...                   3600 x 5400       full bleed       1899                 poster, print, art
canvas         ...            ...           ...                   3600 x 5400       full bleed       3499                 canvas, wall art
blanket        ...            ...           ...                   6000 x 7500       full bleed       4999                 blanket, throw, fleece
pillow_cover   ...            ...           ...                   4500 x 4500       full bleed       2799                 pillow, cushion
towel          ...            ...           ...                   3000 x 6000       full bleed       2499                 towel, bath
shower_curtain ...            ...           ...                   7200 x 7200       full bleed       3999                 shower curtain, bathroom
rug            ...            ...           ...                   3600 x 6000       full bleed       4999                 rug, mat, floor
tumbler        ...            ...           ...                   8268 x 3437 wrap  white bg         2799                 tumbler, bottle, drink
ornament       ...            ...           ...                   1500 x 1500       transparent     1499                 ornament, holiday
journal        ...            ...           ...                   3300 x 4200       full bleed       2199                 journal, notebook
magnet         ...            ...           ...                   900 x 900         full bleed       899                  magnet, fridge
kids_tshirt    ...            ...           ...                   3600 x 4200       transparent     2099                  kids tee, youth
long_sleeve    ...            ...           ...                   4500 x 5400       transparent     2599                  long sleeve
sweatshirt     ...            ...           ...                   4500 x 5400       transparent     3499                  sweatshirt, crewneck
baby_onesie    ...            ...           ...                   3000 x 3600       transparent     1899                  onesie, bodysuit
baby_bib       ...            ...           ...                   1500 x 1500       transparent     1499                  bib, baby
hat            ...            ...           ...                   2400 x 2400       embroidery-safe 1999                  hat, cap, bucket
socks          ...            ...           ...                   3675 x 1200       full bleed       1599                 socks
underwear      ...            ...           ...                   3600 x 3600       full bleed       1899                 underwear
pet_bandana    ...            ...           ...                   2400 x 2400       full bleed       1499                 pet, dog, bandana
backpack       ...            ...           ...                   4000 x 4000       full bleed       3499                 backpack, bag
fanny_pack     ...            ...           ...                   3600 x 2400       full bleed       2299                 fanny pack
laptop_sleeve  ...            ...           ...                   3600 x 2400       full bleed       2499                 laptop sleeve
puzzle         ...            ...           ...                   3000 x 2400       full bleed       2199                 puzzle, jigsaw
plush_bear     ...            ...           ...                   apparel patch     transparent     2999                  plush, teddy
face_mask      ...            ...           ...                   2400 x 1500       full bleed       1299                 face mask
notebook_spiral ...           ...           ...                   3300 x 4200       full bleed       1799                 notebook, spiral
postcard       ...            ...           ...                   1875 x 1275       full bleed       599                  postcard
keychain       ...            ...           ...                   900 x 900         transparent     999                   keychain
```

Exact Printify blueprint IDs / provider IDs / variant IDs come from the Printify catalog API — the catalog module exposes a `getDefaultsForType(type)` helper used by both preflight and the secondary-project creator.

### Phase 2 — Extend preflight + creator

- `pod-preflight.ts`: replace the 4-type if-chain with a lookup against the catalog (`catalog[type].descKeywords` and `catalog[type].retailPriceCents`). Add a `bg_requirement` check (full-bleed types must NOT have `transparent` in the prompt; transparent types must include it; mug/tumbler/candle must include `white`).
- `printify-product-creator` (secondary project, `zmyczlfuufhngzovkjdh`): rewrite the body handler to look up blueprint/provider/variant/print-area from the same catalog module instead of the hard-coded 4-type switch. Add image-dimension validation: after DALL-E generates the design, reject + retry if the returned image's aspect ratio is off from the catalog's print-area ratio by more than ±5%.
- `pod-product-orchestrator`: no changes needed — it just forwards `product.type` and logs.

### Phase 3 — Run the publish batch

1. `POST /etsy-trend-scanner` (no body), wait for completion.
2. `SELECT niche, trend_signals FROM etsy_trend_runs WHERE run_date = CURRENT_DATE ORDER BY created_at DESC LIMIT 50` — use these niches as the trending pool.
3. `SELECT product_type, niche FROM pod_listings` — full list of existing products to dedupe against.
4. For each of the ~40 product types in the catalog:
   - Pick the highest-favoriting trending niche not already used by that type (or any type, to keep each listing distinct).
   - Build the product object with the catalog's `retailPriceCents`, type-specific `imagePrompt` that includes the exact print-area dimensions + bg requirement, 13 tags ≤20 chars, 200–1800 char description that includes the required keywords.
   - `POST /pod-product-orchestrator` with `{ product, niche, source: "manual-catalog-fill", run_id }`.
   - Wait 5s between calls.
5. Final report: total succeeded, total failed (with reasons from preflight), and a list of every listing created with its Printify ID + Etsy listing ID.

### Phase 4 — Verification

- `SELECT product_type, COUNT(*) FROM pod_listings WHERE source_run_id = '<this run>' GROUP BY product_type` — confirm one row per type.
- `SELECT stage, ok, COUNT(*) FROM pod_publish_logs WHERE run_id = '<this run>' GROUP BY stage, ok` — confirm no silent failures.
- Spot-check 3 listings on Etsy to confirm the design fits the print area (no clipping on the mug wrap, full-bleed on the phone case, centered on the tote).

---

## Technical notes

- This work touches the **secondary** Supabase project (`zmyczlfuufhngzovkjdh`) because that's where `printify-product-creator` lives. Per CLAUDE.md, GitHub Actions deploys to that project via `SUPABASE_ACCESS_TOKEN`. The shared catalog module needs to be duplicated (or fetched) into both projects.
- Printify catalog API: `https://api.printify.com/v1/catalog/blueprints.json` — used once during Phase 1 to populate the catalog module with real IDs.
- Each listing costs ~1 DALL-E call + Printify API + Etsy publish — budget for ~40 generations.
- Banned-content rules in preflight (Disney, Marvel, NFL, etc.) still apply.

---

## What I will NOT do in this plan

- Won't add new product types that Printify doesn't actually offer.
- Won't republish existing types if a working listing already exists for the niche I'd pick — I'll pick the next trending niche down the list.
- Won't change the 4 existing pricing tiers; new types get prices from the catalog table above.
- Won't touch any non-POD code (no Trade Radar, Mortgage Radar, etc.).
