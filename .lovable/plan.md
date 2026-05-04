# Full Readiness Audit + Silent-Killer Sweep

Three buckets: (1) the screenshot fires, (2) the two open bugs you flagged, (3) product-by-product gap close to 100%.

## Bucket 1 — Screenshot fires (kill today)

### A. TechAlert Sonar OFF (HTTP 402)

`techalert-prospect-hunter` is calling OpenRouter `perplexity/sonar-pro` and getting **402 = out of credits / billing**. Result: 286 candidates re-scanned, 0 new.

Fix:

- Detect 402 once → set `circuit_breakers.openrouter_sonar.open = true` for 24h instead of hammering it every run
- Fail over to `**google/gemini-2.5-flash` via Lovable AI Gateway** (free, already wired in `_shared/ai.ts`) for the OSINT prompt — same JSON schema, ~80% of Sonar's hit rate per the talent-radar v5 audit
- SMS Matt **once** when breaker trips (not every cron), with "top up OpenRouter" link
- Add `OPENROUTER_API_KEY` balance check to `weekly-admin-digest`

### B. Dead Lead pool = 0 pending

Drip has nothing to send because no contractor has uploaded contacts. Two fixes:

- **Auto-refill from existing systems**: nightly job pulls `marketplace_prospects` + `outreach_leads` rows that went cold (no reply 30+ days) into `dead_lead_contacts` for the house account, gated on TCPA/EBR
- **Visibility**: `weekly-admin-digest` already reports pool size — promote to *daily* SMS when pool < 25 so you stop finding out via the 2pm sweep
- Add a "Seed sample contacts" button on `/dead-lead-intake` for new signups so the pipeline isn't dry on day 1

## Bucket 2 — Two bugs you called out

### C. Roofing/HVAC/Plumbing scanners silently failing

Need to verify before claiming fixed. Plan:

1. Curl `trade-radar-scanner` for each of the 11 verticals, capture `{ inserted, skipped, quarantined, errors }`
2. Pull last 24h `trade_radar_leads` row counts per vertical from DB
3. Pull last 24h `quarantine_history` reasons — if `validation_unavailable` or `validation_api_error` show up, the Phase 38 fail-OPEN didn't deploy or `GOOGLE_MAPS_API_KEY` is missing in **Supabase Edge Function** secrets (separate store from Lovable Cloud) i think i fixed this so check.
4. Tail `supabase--edge_function_logs trade-radar-scanner` for thrown errors per vertical
5. For any vertical with zero inserts AND zero quarantines, the scanner function itself is throwing before the validator — fix per error class

### D. Google Address Validation rejecting 60% of mortgage signals

FSBO/estate-sale/probate listings often only give "123 Main St, Detroit" with no ZIP. Current validator needs full address. Fix in `_shared/anti-hallucination.ts`:

- **Tiered acceptance**:
  - Tier 1 (govt/scraper sources w/ full address): require `result.verdict.addressComplete === true`
  - Tier 2 (FSBO/estate/probate/LLM): accept on `addressComplete=false` if street+city present, mark lead `validation_tier=2`, cap score at 6, require second-source corroboration before SMS dispatch
  - Tier 3 (LLM-only, no corroboration): quarantine as today
- Add `validation_tier` column to `mortgage_radar_leads` + `trade_radar_leads`
- Backfill: re-run last 30 days of quarantined-with-`addressComplete=false` rows through new logic to recover lost leads

## Bucket 3 — Product Readiness Audit → 100%

For each product I will: (a) read the portal page + scanner + checkout + webhook, (b) check cron schedules and last-run timestamps, (c) verify enrichment trace exists on recent leads, (d) check empty-state UX, (e) check guarantee/credit flow. Then ship the gaps.

Current Phase 40 scores → target 100%:


| Product           | Now | Known gaps to close                                                                                                                          |
| ----------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Mortgage Radar    | 93% | Compliance PDF download, CRM webhook (HubSpot/Salesforce)                                                                                    |
| Trade Radar (×11) | 88% | Owner contact column display in card already done — verify; nationwide ZIP onboarding flow; lead-credit policy + UI                          |
| SiteRadar         | 85% | Detail panel done — verify Clearbit fallback fires; weekly digest cron health                                                                |
| TechAlert         | 82% | Sonar failover (Bucket 1A); Eventbrite key in Supabase secrets; ATS push (Greenhouse webhook)                                                |
| ContractorLeads   | 80% | Credit request → automated Stripe credit memo (currently mailto only)                                                                        |
| Missed-Call       | 80% | After-hours auto-text template editor; Google review URL onboarding wizard                                                                   |
| FieldDesk         | 82% | Real job dispatch UI (currently board-only); tech location ping cron                                                                         |
| Buyer Radar       | 75% | Signal source thinness — add MLS price-drop + Redfin saved-search scrape                                                                     |
| Dead Lead         | 72% | Bucket 1B refill; landline-pre-screen receipt in dashboard                                                                                   |
| Demand Radar      | 75% | Source diversity (currently 2 sources); empty-state CTA (how does this only have 2 sources?! We have like 100 sources at our disposal! Fix!) |


Each one gets a focused commit. Anything that can't hit 100% without a business decision (pricing, policy, third-party API key) gets surfaced in a single "Matt action items" SMS instead of silently sitting at 92%.

## Bucket 4 — Silent-Killer Sweep

I'll grep + log-audit for the patterns that historically cause silent fails:

- `catch {}` / `catch (e) {}` empty blocks in edge functions (DWA defensive programming protocol violations)
- `Promise.all` without per-item try/catch (one bad source nukes the whole scan)
- Raw `fetch()` to Twilio/Resend bypassing `_shared/twilio.ts` / `dwaEmail()` (TCPA + brand drift)
- pg_cron jobs whose last_run > 48h (broken silently)
- Edge functions throwing 500s in last 7d that don't SMS Matt
- Circuit breakers stuck `open=true` past their cooldown
- Tables with last insert > 7d that should be daily

For each finding: fix or document why it's expected. Output goes to `knowledge/silent_killers_2026_05_04.md` so we have a baseline.

## Deliverable order

1. Sonar 402 failover + breaker (Bucket 1A) — stops the 2pm SMS spam
2. Address validation tiering + backfill (Bucket 2D) — recovers lost mortgage leads immediately
3. Scanner per-vertical diagnostic + fixes (Bucket 2C)
4. Dead Lead auto-refill (Bucket 1B)
5. Silent-killer grep + log audit, fix as found (Bucket 4)
6. Product-by-product gap close (Bucket 3) — one commit per product
7. Final readiness report SMS + updated `CLAUDE.md` Phase 41 section

Approve and I'll execute top-to-bottom in one pass.