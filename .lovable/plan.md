## Goal

1. Pull from git, refresh project memory.
2. Run a **live** price + supply-chain audit across all 501 active Etsy listings and their Printify origins. Definitively answer "who leads the dance."
3. Deliver a 10-point Harvard-grade plan to turn Yarningforyoubylisa → **GNG (Guilds & Grains)** into a hands-off machine: more views, more clicks, better QC, less manual work.
4. Rebrand the Etsy shop end-to-end and build the customer-facing **/gng**, **/guild-and-grains**, **/gifts**, **/gift/:listingId** pages on m2training.

---

## Phase 1 — Sync & memory refresh

- `git fetch && git pull` on dev branch.
- Read `CLAUDE.md` "Current Session State" and update `mem://index.md` Core with: Phase 45 deploy state, Etsy OAuth (Yarningforyoubylisa, shop_id 6311589, 211→501 active listings), POD republish queue status.
- Add a new memory `mem://features/gng-rebrand` capturing: rebrand decision (Yarningforyoubylisa → Guilds & Grains), Etsy=storefront/Printify=source-of-truth (after audit confirms), customer pages live at /gng + /guild-and-grains + /gifts + /gift/:id.

## Phase 2 — Live audit (the test answer)

Run inside a single edge function `gng-supply-chain-audit` (admin-only) so the data is reproducible, not a one-shot script:

**Step A — Pull both sides:**
- Etsy: 501 active listings already in `etsy_products` + `etsy_product_images` (price, title, tags, qty, url).
- Printify: hit `/v1/shops/{shop_id}/products.json` paginated → write to new `printify_products` table (blueprint_id, print_provider_id, variant prices, cost, profit, published_to_etsy, etsy_listing_id mapping, last_modified).

**Step B — Match & diff:**
- Join on `etsy_listing_id` (Printify stores it when published). Bucket each listing:
  - `synced` — both sides agree on price + title + active state
  - `price_drift` — Etsy price ≠ Printify retail price (>$0.50 delta)
  - `orphan_etsy` — Etsy listing not in Printify (manually created, no POD link)
  - `orphan_printify` — Printify product not published to Etsy
  - `margin_thin` — profit < 30% after Etsy fees (6.5% txn + $0.20 + 13% transaction+payment)
  - `dim_fail` — has row in `pod_dimension_audit` with status≠'ok'

**Step C — Who leads the dance:** Decision matrix based on:
- % of listings created via `printify-direct-publish` vs manually on Etsy
- Direction of last-modified timestamps (Printify newer → Printify leads; Etsy newer → Etsy leads)
- Presence of `printify.product_id` in `etsy_products.raw`

Expected verdict (based on existing `printify-auto-sync` + `pod-etsy-publisher` infra): **Printify leads.** Audit confirms or flips it.

**Step D — Report:** New `/dwa-admin` tab "GNG Supply Audit" rendering the buckets, drift dollar value, thin-margin SKUs, and a "Resync drifted" button calling `printify-auto-sync` for just those listings.

## Phase 3 — The 10-point GNG automation playbook

Built into a new `src/pages/dwa-admin/GNGPlaybook.tsx` as a checklist with status pills (todo / wired / live) so it doubles as the implementation tracker.

1. **Printify as single source of truth.** Lock manual Etsy edits via daily `etsy-drift-detector` cron — if Etsy title/price/desc diverges from Printify, auto-revert and SMS Lisa with the diff.
2. **Dynamic margin-floor pricing.** New `gng-price-optimizer` runs nightly: pulls Printify cost + variant, applies floor (cost × 2.4 + $4.50 fees), bumps Etsy price via `etsy-shop-update` if drift > 5%. Never undercuts margin.
3. **Pre-publish QC gate (already partially built via `pod-image-regression-log`).** Extend `_shared/pod-image-regression.ts` so NO Printify product publishes to Etsy without full-bleed + correct DPI + transparent-bg check + AI brand-consistency score (Gemini 2.5 Flash Image judges against 5 reference mockups). Fail → quarantine + Slack/SMS, never silent.
4. **AI-written SEO listings.** `gng-listing-writer` (Gemini 2.5 Pro) generates title (140-char Etsy max, front-loaded keyword), 13 tags from Etsy trending-tag scraper (`etsy-trend-scanner` exists), description with story + materials + care, all from Printify blueprint metadata. Runs on every new Printify product.
5. **Hero-image auto-mockup pipeline.** Nano Banana 2 generates 5 lifestyle scenes per product (kitchen shelf, gift unboxing, holiday flatlay, nursery, in-hand scale). Replaces Printify's generic mockups. QC gate from #3 validates output.
6. **Trending-tag rotation.** Weekly cron pulls Etsy's "trending searches" via Etsy API + Marmalead-style scraping (Firecrawl on competitor top sellers), rewrites the 13 tags on bottom-50% performers (by `etsy_sales_sync` data). Already have `etsy-winner-prioritizer` — wire it to the rewriter.
7. **Review-velocity boost.** `etsy-post-purchase-followup` sends branded thank-you email 3 days after delivery (use Resend + ShipStation/Etsy fulfillment webhook), 7 days later asks for review with one-tap link. Targets 4.9★ moat.
8. **Auto-reply triage.** Etsy Messages API → inbound goes through `gng-message-triage` (Haiku) which auto-replies to FAQs (shipping, customization, returns) using a curated knowledge base, escalates only edge cases to Lisa via SMS. Cuts inbox by ~70%.
9. **Cross-channel funnel.** /gng + /guild-and-grains + /gifts pages built on m2training (Phase 4) drive higher-margin direct-to-Stripe Printify orders, bypassing Etsy's 13% take. Etsy stays for discovery + reviews; m2training is the conversion engine. UTM tags + Pinterest/IG auto-poster (`gng-social-rotator` posts new listings to 3 channels on publish).
10. **Weekly autopilot digest.** Monday 8am email to Lisa + Matt: new listings published, drift fixed, QC fails quarantined, top sellers, dead stock (no views in 30d → auto-deactivate), review velocity, revenue split (Etsy vs direct). One page, no dashboards to check.

## Phase 4 — Storefront pages on m2training

Single shared storefront component, 4 route aliases (all reuse the existing `src/sandbox/guildgrain/` design system — warm cream, serif headings, artisan vibe):

```text
/gng                  ─┐
/guild-and-grains     ─┼─→ <GNGStorefront/>  (full catalog, filters, hero, brand story)
/guilds-and-grains    ─┘
/gifts                ─→  <GiftFinder/>      (quiz: occasion → recipient → budget → curated subset of GNGStorefront)
/gift/:listingId      ─→  <GiftShare/>       (single-listing share page, OG image, "send this gift" CTA)
```

- Pulls live from `etsy_products` + `etsy_product_images` (already wired in `EtsyTab.tsx` — promote that code into a real page).
- Each card: image carousel, price, "Buy on Etsy ↗" + "Buy direct (save 10%)" buttons (direct route TBD in Phase 3 #9, scaffolded with toast for now).
- SEOHead with JSON-LD `Product` schema, OG image, canonical.
- New nav entry on m2training under "Shop" → "Guilds & Grains".
- Rebrand assets: regenerate logo via Nano Banana 2 ("Guilds & Grains" wordmark, serif, warm earth tones), favicon, og:image.
- Etsy shop rename: call `etsy-shop-update` with new shop_name="GuildsAndGrains" (Etsy allows 1 rename per account — confirm with Lisa before firing).

## Technical details

- **Tables added:** `printify_products` (id, etsy_listing_id, blueprint_id, retail_cents, cost_cents, profit_cents, raw jsonb, last_modified, synced_at); `gng_audit_runs` (run_id, ran_at, totals jsonb, drift_dollars).
- **Edge functions added:** `gng-supply-chain-audit`, `gng-price-optimizer`, `gng-listing-writer`, `gng-message-triage`, `gng-social-rotator`, `etsy-drift-detector`, `etsy-post-purchase-followup`. All `verify_jwt = false` for crons; admin trigger via signed `X-Admin-Key`.
- **Crons:** drift detector (hourly), price optimizer (3am ET), trend rotation (Sun 4am), weekly digest (Mon 8am ET), social rotator (on Printify webhook).
- **Secrets needed:** `PRINTIFY_API_KEY` (verify present — used in existing functions), `ETSY_API_KEY` (present), Resend (present).
- **Frontend chunks:** lazy-load GNG storefront via `lazyRetry`; isolate in Vite manualChunks.

## Out of scope (this loop)

- Native checkout on m2training for direct-Printify orders (Phase 3 item #9 just scaffolds; full Stripe→Printify order pipeline is a follow-up plan).
- Migrating reviews from Yarningforyoubylisa to new shop name (Etsy auto-carries reviews on rename — no action needed).
- Killing the `Yarningforyoubylisa` shop URL — Etsy auto-redirects on rename.

---

**Order of work after approval:**
Phase 1 (5 min) → Phase 2 audit + admin tab + report back numbers (~30 min) → Phase 4 storefront pages (parallel) → Phase 3 #1–#3 + #10 (highest leverage, ship first) → Phase 3 #4–#9 (rolling).