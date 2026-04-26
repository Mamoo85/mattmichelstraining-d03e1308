## Audit: "eBay for Leads" — where we actually are

**Verticals live in `unified_lead_marketplace_view` (browseable at `/marketplace`):**
- Mortgage: 228 leads ✅
- Talent (newly licensed trades/healthcare): 242 ✅
- Supply (gov contracts/RFQ): 223 ✅
- Demand (storms/permits/expansions): 14 — thin
- Growth (B2B intent): 0 — empty pipeline

**What works today:**
- Unified browse view, locked dossier cards, Stripe à-la-carte checkout (`create-marketplace-lead-checkout`), DB-level double-sell prevention (`marketplace_lead_locks` partial unique index), magic-link claim, dossier PDF generation, watch list, saved searches, hot-zone notifier, weekly scorecard, share-token, score-bump alerts, First Look subscription upsell, buyer receipts portal.

**What is broken or missing:**
1. `lead_exchange_listings` table exists with auction/auto-route scaffolding but is **empty and unused** — orphaned.
2. Demand + Growth verticals have ~0 inventory — UI shows empty state, kills trust.
3. **No per-lead enrichment audit log.** `candidate_enrichment_log` exists but only covers TechAlert candidates. The other 4 verticals run through `lead-enrichment-waterfall` / `marketplace-lead-free-enrich` / `marketplace-lead-equity-enrich` / `marketplace-lead-gov-enrich` with **zero per-lead trace** — when enrichment fails, it fails silently.
4. No buyer-side "what was checked, when, by whom" provenance shown on the dossier.
5. No refund-eligibility signal tied to enrichment quality.
6. Pricing is static (`lead_exchange_pricing` table) — no demand-based dynamic pricing.
7. No auction or "highest bid wins" mode despite the column existing.

---

## Plan: 20 improvements + universal enrichment audit log

### Foundation — Universal enrichment audit log (the headline ask)

**A1. New table `lead_enrichment_audit`** — one row per enrichment function call against any lead in any vertical.
```
id, lead_id, vertical (mortgage|talent|demand|supply|growth|contractor),
function_name, stage (free|paid|gov|equity|deep|score),
provider (snov|apollo|hunter|pdl|sonar|google|firecrawl|internal),
started_at, finished_at, duration_ms,
success, http_status, error_code, error_message,
fields_added text[], cost_cents, raw_response jsonb,
triggered_by (cron|webhook|manual|on_demand|buyer_view), actor (user_id|system),
created_at
```
RLS: admin read all, service_role write, lead owner reads only the row's `lead_id` they own; buyers see a redacted view (function_name, stage, success, finished_at — no raw_response, no cost).

**A2. Shared helper `_shared/enrichment-audit.ts`** — `logEnrichment(lead_id, vertical, opts)` wrapper that times the call, swallows nothing, and writes one row regardless of success/failure. Drop into all 12 enrichment edge functions.

**A3. Wire into all enrichment functions:** `lead-enrichment-waterfall`, `marketplace-lead-free-enrich`, `marketplace-lead-free-enrich-batch`, `marketplace-lead-equity-enrich`, `marketplace-lead-gov-enrich`, `marketplace-lead-summarize`, `mortgage-radar-enrich`, `mortgage-radar-enrich-drain`, `enrich-prospect-pool`, `enrich-lo-prospect`, `enrich-visitor`, `apollo-test-enrich`. Each call wrapped — no silent failures ever again.

**A4. Admin UI: `AdminEnrichmentAudit.tsx` tab** — filterable table (vertical, provider, success, date range), per-lead drill-down timeline, weekly cost-per-lead rollup, provider failure rate chart. Add to DWAAdmin.

**A5. Buyer dossier "Provenance" panel** — on the unlocked dossier (`SoldDossierCard`), show "Enrichment trail: 7 sources checked, 5 succeeded, last verified 2h ago" with a click-to-expand list (function name + timestamp + success badge, no costs, no raw payloads).

### B. Sell-readiness fixes (immediate revenue)

**B6. Seed Demand + Growth verticals** — wire `omni-lead-engine` to populate Demand from existing storm/permit feeds (we already pull MIOSHA permits + NOAA storms) and Growth from `prospect_pool` filtered by hiring/expansion signals. Cron every 6h. Target: ≥40 leads per vertical before either is shown to buyers.

**B7. Empty-state guards** — if a vertical has <10 available leads, hide it from the chip row and show a "Restocking — get notified" capture instead of an empty grid.

**B8. Activate `lead_exchange_listings` auction mode** — finish the orphaned scaffolding: 24h auction (`auction_3` mode) for top-tier hot leads with 3 max bidders, highest bid wins, runners-up get autoroute discount. New function `marketplace-auction-tick` (cron every 5 min).

**B9. Auto-route mode** — for First Look subscribers, when a `hot` tier lead lands in their saved-search ZIPs, auto-charge their saved card and ship the dossier. Uses existing `marketplace_first_look_subscribers` + Stripe customer payment method.

**B10. Per-vertical landing pages** — `/marketplace/talent`, `/marketplace/demand`, `/marketplace/supply`, `/marketplace/growth` — vertical-specific copy + sample dossier + ICP. Currently all 5 verticals share one generic page.

### C. Trust + conversion (lift close rate)

**C11. Refund-eligibility badge** — leads with <3 successful enrichment hits get a "Verified-Lite" badge and auto-qualify for the existing `lead-auto-refund` 24h guarantee with no human review. Cuts refund disputes.

**C12. Live "X bought in last 24h" social proof** per vertical (already have `marketplace_buyer_views` data — surface aggregated count).

**C13. Replace Stripe redirect with embedded `prebuilt` checkout** so buyers don't leave the marketplace tab — known iOS Safari conversion killer.

**C14. Saved-payment-method "1-click buy"** for repeat buyers — once a buyer has bought 1+ lead, store the Stripe customer + payment method and offer "Buy now ($49) — saved card ending 4242".

**C15. Lead-quality score breakdown** — on the locked card, show "Score 87 = recency 32 + signal 28 + verification 27" so buyers understand pricing.

### D. Pricing + inventory ops

**D16. Demand-based dynamic pricing** — extend `lead_exchange_pricing` with `dynamic_multiplier` calculated nightly from view-to-buy ratio per vertical/ZIP. Hot ZIPs price up, dead ZIPs price down to clear inventory.

**D17. Inventory low-water alerts** — `lead_inventory_thresholds` table exists but is unused. Wire a cron that SMS-alerts Matt when any vertical drops below threshold, so we re-run the source crawler.

**D18. Stale-lead auto-pull** — leads >14 days old with zero buyer views auto-pull from listings, get re-enriched (logged in `lead_enrichment_audit`), and re-list with fresh score. Prevents zombie inventory.

### E. Buyer side

**E19. Buyer dashboard `/my-marketplace`** — shows purchased leads, dossier downloads, refund status, watched leads, saved searches in one place. Currently scattered across `/marketplace-receipts` + email.

**E20. Lead Q&A widget on dossier** — buyers can ask one clarifying question per purchase ("Is the homeowner reachable evenings?") that fires `lead-quality-scorer` to re-check and reply within 1h. Differentiator vs static lead-list competitors.

---

## Files to create / change

**New (10):**
- `supabase/migrations/<ts>_lead_enrichment_audit.sql` — table + RLS + buyer-redacted view
- `supabase/functions/_shared/enrichment-audit.ts` — `logEnrichment()` helper
- `supabase/functions/marketplace-auction-tick/index.ts`
- `supabase/functions/marketplace-autoroute-firstlook/index.ts`
- `supabase/functions/marketplace-inventory-alert/index.ts`
- `supabase/functions/marketplace-stale-lead-sweeper/index.ts`
- `supabase/functions/marketplace-dynamic-pricing/index.ts`
- `src/components/admin/AdminEnrichmentAudit.tsx`
- `src/components/marketplace/EnrichmentProvenancePanel.tsx`
- `src/pages/MyMarketplace.tsx`

**Edit (15):**
- 12 enrichment edge functions — wrap calls with `logEnrichment()`
- `src/pages/Marketplace.tsx` — empty-state guard, score breakdown, social proof
- `src/components/marketplace/SoldDossierCard.tsx` — provenance panel
- `src/pages/DWAAdmin.tsx` — register enrichment-audit tab + route

**Verification:**
1. `psql -c "SELECT vertical, count(*), avg(duration_ms) FROM lead_enrichment_audit WHERE created_at>now()-interval '1h' GROUP BY vertical"` returns rows after first cron tick
2. Force a Snov 429 → confirm row appears with `success=false, error_code='429'` instead of silent failure
3. Buy a lead → unlocked dossier shows "7 sources checked" panel
4. Demand vertical hidden from chip row when <10 leads available
5. Auction tick cron creates `lead_exchange_listings` rows in `live` status

---

## Scope warning

This is a large plan — **~10 new files, 15 edits, 1 migration, 5 new cron jobs**. I'd recommend approving in two phases:
- **Phase 1 (must-ship):** A1–A5 (audit log) + B6–B7 (inventory) + C11 (refund badge). 6 items, ~1 day of build.
- **Phase 2:** B8–B10, C12–C15, D16–D18, E19–E20. Bigger lift.

Tell me "approve phase 1" or "approve all 20" and I'll switch to build mode.
