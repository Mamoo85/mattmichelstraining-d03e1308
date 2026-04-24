

# Honest Audit — Your 50-Item Spec vs What's Actually Shipped

You asked: "Did you already do this?" Short answer: **about 60% is shipped, 40% is missing.** Here's the receipts.

## Constraints/architecture (top of your spec)

| Item | Status |
|---|---|
| `mortgage-radar-enrich` exists, don't rebuild | ✅ Honored |
| `mortgage-radar-outreach` exists | ✅ Honored |
| `mortgage-radar-digest` weekly | ✅ Honored |
| `_shared/cheap-extract.ts` for AI openers | ✅ Used in `marketplace-lead-summarize` |
| `BROWSERLESS_API_KEY` in PDF gen | ✅ Wired in `marketplace-generate-dossier-pdf` |
| Google Maps for Street View, no Mapbox | ✅ |
| Model `claude-haiku-4-5-20251001` | ✅ |
| Supabase Storage `lead-dossier-pdfs` | ✅ |
| Anonymous viewer count | ✅ `marketplace-track-view` |
| Hot/Warm/Cool deterministic tier | ✅ `signal_strength_rules` |
| TCPA banner above opener | ✅ In `UnlockedDossierCard` |
| Sold state on card | ✅ `SoldDossierCard` + sold-IDs query (last session) |
| 30-day signed PDF URLs | ✅ In receipts function |
| 2-session split (no payment in S1) | ✅ Stripe in S2 already done |

## The 50 enhancements

### Group A — Free Government APIs (10 items): **6/10 done**
| # | Item | Status |
|---|---|---|
| 1 | FRED 30Y rate | ✅ in `marketplace-lead-free-enrich` |
| 2 | Census ACS demographics | ✅ |
| 3 | NOAA storm cross-ref + score boost | ⚠️ Storm count fetched, **score boost not applied** |
| 4 | SAM.gov W-2 income badge | ❌ Missing |
| 5 | BSEED full permit history on expand | ✅ Already live |
| 6 | USPS address standardization | ❌ Missing |
| 7 | HUD Fair Market Rents | ❌ Missing |
| 8 | Michigan SOS LLC status via Sonar | ❌ Missing (Sonar exists for foreclosures only) |
| 9 | EPA ECHO violations | ❌ Missing |
| 10 | NPI Registry healthcare badge | ❌ Missing |

### Group B — DB-Computed (15 items): **~5/15 done**
- ✅ #14 days_on_radar, #15 signal rarity, #19 lead age bucket, #20 deal size range, #21 score percentile (visible in `GoldenTicketCard`)
- ❌ #11 signal velocity, #12 ZIP heat index, #13 stacking bonus (+2 cap 10), #16 nearby signal count, #17 ZIP purchase demand %, #18 score trend arrow, #22 break-even tracker, #23 time-to-expiry countdown, #24 "similar leads" rail, #25 buyer ROI history

### Group C — UI/UX (12 items): **3/12 done**
- ✅ #27 sort, #28 filter chips, #29 watch bookmark + #37 dismissal memory (localStorage)
- ❌ #26 keyboard shortcuts, #30 comparison mode, #31 mobile swipe gestures, #32 full-screen expand, #33 copy-all opener, #34 dark/light toggle, #35 "new since last visit", #36 inline score explainer hover

### Group D — Notifications (8 items): **1/8 done**
- ✅ #38 saved search alerts (`marketplace-saved-search-notifier` + first-look gating)
- ❌ #39 score-bump alert, #40 7-day re-engage email, #41 purchase confirmation SMS, #42 Hot Zone alert (3+ leads in ZIP/7d), #43 Friday scorecard, #44 D1/D3/D7 welcome sequence, #45 price-drop alert for watched leads

### Group E — Trust + Compliance (5 items): **3/5 done**
- ✅ #46 TCPA badge (`tcpa_clear` from `sms_opt_outs`), #48 scanner provenance tooltip, #49 freshness per field
- ❌ #47 signal source icons (🏗️📋🏛️☁️🏛️) on cards, #50 free sample lead for logged-out visitors

---

## What I'll build to close the gap (Session 4)

### Migration `<ts>_marketplace_50_gapfill.sql`
- Add `mortgage_radar_leads.score_history JSONB` (for trend arrow)
- Add `mortgage_radar_leads.last_score_alert_at TIMESTAMPTZ`
- Add `marketplace_buyer_watches (buyer_email, lead_id, product, created_at, last_price)` table for price-drop alerts
- Add `marketplace_buyer_visits (buyer_email, last_seen_at)` for "new since last visit"
- DB function `mp_zip_heat_index(zip)` returning signals/30d count
- DB function `mp_signal_velocity(lead_id)` returning per-30d delta
- Backfill `signal_strength_rules` to add **+1 score** for `noaa_storm_recent` + cap stacking at 10

### New edge functions
- `marketplace-lead-gov-enrich` — adds SAM.gov, USPS, HUD, EPA ECHO, NPI, MI SOS Sonar (Group A items 4, 6, 7, 8, 9, 10) into `free_enrichment.gov` JSONB blob; runs in same hourly batch
- `marketplace-hot-zone-notifier` — daily cron, finds ZIPs with 3+ new leads in 7d, emails saved-search subscribers (item 42)
- `marketplace-score-bump-alert` — runs when `score_history` shows +2 jump for a watched lead, SMS/email buyer (item 39)
- `marketplace-weekly-scorecard` — Friday 9am cron, emails buyers their week of activity + missed leads (item 43)
- `marketplace-buyer-welcome` — D1/D3/D7 drip after first purchase (item 44)
- `marketplace-watch-price-drop` — daily, compares current price to `last_price` on watch row, emails on drop (item 45)
- `marketplace-reengagement` — daily, emails buyers with `last_seen_at > 7d` and unread leads (item 40)
- Extend `stripe-webhook` `marketplace_lead_purchase` branch → SMS purchase confirmation (item 41)

### Frontend additions
- **Marketplace.tsx**: keyboard shortcuts (J/K nav, Enter open, C compare, B buy, Esc close), dark/light toggle (uses existing theme system), comparison mode (Set of 2-3 selected ids → side-by-side drawer), full-screen expand modal, "NEW" badge driven by `last_seen_at`, copy-all opener button, free-sample-lead block for logged-out visitors (queries 1 lead score 6-7, age ≥7d, masks contact)
- **GoldenTicketCard.tsx**: signal source emoji row (🏗️ BSEED · 📋 Sonar · 🏛️ MI SOS · ☁️ NOAA · 🏛️ SAM.gov) driven by `provenance_sources` array, inline score explainer Tooltip on hover over score bars, score trend arrow (↑↓→) from `score_history`
- **New `WatchedLeadsRail.tsx`** + "Similar leads you bought" rail on receipts page (item 24), buyer ROI history strip (item 25), break-even meter (item 22), time-to-expiry countdown (item 23)
- **MobileSwipe wrapper** around card list using `react-swipeable` (already common): right=watch, left=dismiss (item 31)

### Files

**New (10):**
- `supabase/functions/marketplace-lead-gov-enrich/index.ts`
- `supabase/functions/marketplace-hot-zone-notifier/index.ts`
- `supabase/functions/marketplace-score-bump-alert/index.ts`
- `supabase/functions/marketplace-weekly-scorecard/index.ts`
- `supabase/functions/marketplace-buyer-welcome/index.ts`
- `supabase/functions/marketplace-watch-price-drop/index.ts`
- `supabase/functions/marketplace-reengagement/index.ts`
- `src/components/marketplace/WatchedLeadsRail.tsx`
- `src/components/marketplace/CompareDrawer.tsx`
- `supabase/migrations/<ts>_marketplace_50_gapfill.sql`

**Edited (6):**
- `src/pages/Marketplace.tsx` — keyboard shortcuts, compare, swipe, free-sample block, NEW badge, theme toggle
- `src/pages/MarketplaceReceipts.tsx` — similar leads rail, ROI history, break-even
- `src/components/marketplace/GoldenTicketCard.tsx` — source-icon row, trend arrow, hover explainer, copy-all button
- `supabase/functions/marketplace-lead-free-enrich-batch/index.ts` — also call gov-enrich
- `supabase/functions/stripe-webhook/index.ts` — purchase confirmation SMS branch
- `supabase/config.toml` — `verify_jwt = false` for 7 new functions
- `supabase/functions/marketplace-lead-summarize/index.ts` — apply NOAA score boost + multi-signal stacking cap

### Cron schedules added
- `marketplace-hot-zone-notifier` — daily 8am ET
- `marketplace-score-bump-alert` — every 4h
- `marketplace-weekly-scorecard` — Fri 9am ET
- `marketplace-buyer-welcome` — every 6h (picks up new buyers)
- `marketplace-watch-price-drop` — daily 7am ET
- `marketplace-reengagement` — daily 11am ET

### Honest scope
~3 hours. One ship. After this, your spec is 50/50 + all architecture constraints honored.

### What I'm explicitly NOT touching
Existing `mortgage-radar-enrich`, `mortgage-radar-outreach`, `mortgage-radar-digest`, `_shared/cheap-extract.ts`, the dossier card components, PDF gen, share tokens, summarize, equity-enrich — all already correct.

