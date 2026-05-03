
## What you're right about

I checked every enrichment/scanner function against the upgrades we shipped tonight (unified `runEmailWaterfall`, `_shared/apollo.ts` helper, aggregator-domain filter, Google Places website fallback, enterprise blocklist). Most have NOT been updated. Here is the audit:

```text
function                              waterfall  apollo-helper  aggregator-filter  google-places  raw-apollo(bad)  raw-hunter(bad)
techalert-enrich                          Y           Y              Y                  Y               .                .   ✅ gold standard
contractor-outreach-enrich                .           Y              .                  .               .                .
outreach-leads-enrich                     .           Y              .                  .               .                .
dwa-v4-roofing-enrich                     .           Y              .                  .               .                .
enrich-prospect-pool                      Y           .              .                  Y               Y (bypass)       Y (bypass)
prospect-email-backfill                   Y           .              .                  .               .                .
contractor-prospector                     .           .              .                  .               .                .
channel-prospector                        .           .              .                  .               .                .
mortgage-radar-enrich                     .           .              .                  .               .                .
marketplace-lead-equity-enrich            .           .              .                  .               .                .
marketplace-lead-free-enrich              .           .              .                  .               .                .
marketplace-lead-gov-enrich               .           .              .                  .               .                .
batch-enrich-candidates                   .           .              .                  .               .                .
candidate-deep-enrich                     .           .              .                  .               .                Y
agency-contact-enrich                     .           .              .                  .               Y                Y
enrich-supply-buyers                      .           .              .                  Y               .                .
buyer-contact-enrich                      .           .              .                  .               Y                Y
enrich-lo-prospect                        .           .              .                  .               Y                .
find-lo-prospects                         .           .              .                  .               Y                .
```

Plus 11 trade-radar `signals-*.ts` files all use the same scanner shell — those are already on the latest source list (Phases 33–35), so they're fine.

## Plan

### 1. Promote the techalert-enrich pattern into a shared helper

Create `supabase/functions/_shared/enrichment-pipeline.ts` exporting:

- `isAggregatorDomain(domain)` — pulls the 30+ aggregator list out of techalert-enrich
- `isEnterprise(name, employees?)` — moves `ENTERPRISE_BLOCKLIST` + 500-employee guard into shared
- `googlePlacesWebsite(business, city, state)` — Find Place + Place Details fallback
- `cleanWebsite(url)` — strips aggregator hostnames; returns null if dirty
- `enrichOwnerEmail(input)` — wraps `runEmailWaterfall` + Apollo people-search with owner-title preference and aggregator scrubbing

Single source of truth. Refactor `techalert-enrich` to import from here so behavior is preserved.

### 2. Migrate every enrichment function to the shared helper

In priority order (revenue impact first):

1. `contractor-outreach-enrich` + `contractor-outreach-enrich-backfill`
2. `mortgage-radar-enrich` + `mortgage-radar-enrich-drain`
3. `outreach-leads-enrich`, `outreach-target-enrich-backfill`
4. `marketplace-lead-{equity,free,gov}-enrich` + `marketplace-lead-free-enrich-batch`
5. `dwa-v4-roofing-enrich`
6. `find-lo-prospects` / `enrich-lo-prospect`
7. `channel-prospector` (currently runs Google Places + DataForSEO already; add aggregator scrub + email waterfall on captured leads)
8. `contractor-prospector`, `hybrid-prospector`, `targeting-prospect-scraper`
9. `agency-contact-enrich`, `buyer-contact-enrich`, `candidate-deep-enrich`, `batch-enrich-candidates`, `enrich-prospect-pool`, `enrich-supply-buyers`, `enrich-visitor`, `capture-enrich`, `apollo-test-enrich`, `enrich-postcard-addresses`, `lookup-postcard-prospect`

For each: delete raw `api.apollo.io` / `api.hunter.io` fetches, replace with shared helpers, add aggregator + enterprise guards, and write trace into `meta.enrichment_trace` so the audit timeline keeps working.

### 3. Backfill reset migration

One migration that, for every prospect/lead table touched above, resets `enriched_at = NULL` and clears any `website` value flagged by `isAggregatorDomain`, so the upgraded functions immediately re-process stale records on the next cron tick.

Tables affected: `techalert_prospect_targets`, `contractor_outreach_prospects`, `mortgage_radar_leads`, `outreach_leads`, `marketplace_prospects`, `agency_prospects`, `buyer_prospects`, `hire_alert_candidates`.

### 4. Admin panel — unify scanner visibility

Build `src/pages/admin/AdminScannerHub.tsx` (linked from `DWAAdmin` → "Scanners & Enrichment" tab) showing one row per scanner with:

- Name, last-run timestamp, last-success count, error count (24h)
- Source list (pulled from a new `scanner_registry` constant we maintain in `_shared/scanner-registry.ts`)
- "Run now" button (invokes the function)
- Link to recent rows produced
- Health badge (green/yellow/red based on 24h yield vs. 7-day avg)

Scanners covered: all 11 trade-radar verticals, mortgage-radar-scanner, techalert-prospect-hunter, contractor-prospector, channel-prospector, hire-alert-scanner, lara-fast-scanner, accela-permit-scanner, permit-watch-scanner, new-business-radar, demand-radar-enhanced-scan, growth-radar-enhanced-scan, dark-web-domain-scan, ada-risk-scanner, competitor-monitor-scan, regulatory-monitor-scan, rfq-bid-scanner, reg-filing-scan, service-gap-scanner, price-intelligence-scanner, industry-pulse-scanner, bid-intel-scan, employee-credential-scan, trademark-watch-scan.

Also extend the existing `src/components/dwa-admin/SourceCatalogPanel.tsx` to show, per source, which scanners consume it (so when you upgrade a source you can see the blast radius).

### 5. Wire monitoring

- Add `scanner_yield_daily` materialized view: `(scanner_name, date, rows_produced, errors)` populated by parsing `error_logs` + each scanner's insert table.
- Extend `outreach-alert-evaluator` with a `scanner_low_yield` rule (warn if any scanner < 50% of 7-day median, crit if 0 rows for 48h). SMS routes to `ADMIN_PHONE` per existing pattern.

### 6. Verification pass

After deploy:

1. Manually trigger each migrated function once, capture row in `enrichment_audit` with full trace, confirm `meta.enrichment_trace` contains the new stage names.
2. Spot-check 3 prospects per function in DB — confirm `website` is non-aggregator, `owner_email` flows where data exists.
3. Confirm `AdminScannerHub` shows all scanners green within 24h.

## Notes for you

- This is mechanical work but touches ~25 edge functions. I'll deploy in batches of 5 and verify each batch before moving on, so a regression doesn't take everything down.
- Nothing in this plan changes pricing, schema-breaking columns, or customer-facing copy.
- Estimated scope: ~30 file edits, 1 migration, 1 new shared helper, 1 new admin page, 1 alert rule.

Approve and I'll start with Step 1 (the shared helper) and Step 2 batch 1 (contractor + mortgage enrich) so we get the highest revenue surface upgraded first.
