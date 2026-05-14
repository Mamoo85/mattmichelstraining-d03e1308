## Why your bill exploded

You have ~25 edge functions calling paid Google APIs daily. Three SKUs are doing the damage:

| API | Cost | Where it's used | Daily volume estimate |
|---|---|---|---|
| **Address Validation** | $5 / 1,000 | Every lead in `trade-radar-scanner` (11 verticals), `mortgage-radar-scanner`, `dead-lead-pool-refresh`, `enrich-prospect-pool` | 5,000–15,000 calls/day |
| **Places API (Details + Text Search)** | $17 / 1,000 | `techalert-prospect-hunter`, `channel-prospector`, `contractor-prospector`, `b2b-*-scraper`, `enrich-supply-buyers`, `cold-email-rank-buyers`, `industry-pulse-scanner` (10+ functions) | 500–2,000 calls/day |
| **Street View Static** | $7 / 1,000 | URL embedded in EVERY `trade_radar_leads` row → billed when admin/customer views the lead card | 1,000–5,000 views/day |

The 24h cache helps but doesn't matter when the source data churns daily (new BSEED permits every morning) — Census ACS, ArcGIS scans, and prospect discovery hit Google fresh every run.

You're right: **almost all of this is free elsewhere.**

---

## The fix — 4 layers

### Layer 1 — Hard budget kill switch (deploys first, stops the bleeding today)

New shared module `_shared/google-budget-gate.ts`:
- New table `google_api_spend_log` tracks every Google call: `function_name`, `api` (`address_validation` / `places` / `streetview`), `cost_cents`, `called_at`
- New helper `canCallGoogle(api): Promise<boolean>` — checks today's spend + month-to-date spend against caps
- New table `google_budget_config`: `daily_cap_cents` (default $1.00), `monthly_cap_cents` (default $15.00 — leaves $5 buffer under your $20 target), kill-switch boolean
- When over budget: function returns `false`, caller falls through to free alternative (or skips)
- Admin SMS alert when 80% of monthly cap hit
- All 25 Google call sites get a 1-line guard: `if (!await canCallGoogle("address_validation")) return freeFallback(...)`

### Layer 2 — Free address validation (replaces 95% of Address Validation API calls)

Rewrite `_shared/anti-hallucination.ts → validateAddress()` with this waterfall:
1. **Cache** (existing 24h cache) — already free
2. **US Census Geocoder** — *https://geocoding.geo.census.gov* — free, unlimited, no key, US-only, returns lat/lon + confidence + matched address. Perfect for Detroit/Michigan addresses. ~99% coverage of BSEED permit data.
3. **Nominatim (OpenStreetMap)** — free, 1 req/sec rate limit, global fallback for non-US or Census misses
4. **Google Address Validation** — only if both above fail AND `score >= 7` AND budget allows. For low-score speculative leads, just accept the address as-is without validation.

This alone cuts Address Validation API spend by ~95%.

### Layer 3 — Free Places / business discovery (replaces Places API)

Replace Google Places calls in `techalert-prospect-hunter`, `channel-prospector`, `contractor-prospector`, `b2b-*-scraper` etc. with a waterfall:
1. **OpenStreetMap Overpass API** — free, returns businesses by category + bounding box (HVAC, electrician, plumber, etc.) for the entire Detroit metro. Already used in your `email-extras-1.ts` for one source — expand to primary.
2. **OpenCorporates** — already a free source you use — for company verification
3. **Yelp Fusion API** — free 5,000 calls/day (need 1 secret) — better contact data than OSM
4. **Google Places** — only if all free sources return empty AND budget allows AND vertical is high-value (TechAlert prospects, mortgage radar)

You already have most of these wired in `_shared/email-extras-*.ts` — this just promotes them from "tier 30" to "primary" and demotes Google to "fallback only."

### Layer 4 — Kill Street View baked-in fetches

Today: every trade radar lead row stores `street_view_url` containing `?key=AIza...` — every page view of a lead card = $0.007. Multiply by Matt + admin + 30+ paying customers viewing leads daily = $30–$100/mo just on image loads.

Fix:
- Stop generating `street_view_url` at insert time
- Replace lead card image with **link to Google Maps** (`https://www.google.com/maps?q=lat,lon`) — opens in new tab, zero API cost, customer still sees the property
- Optional: lazy-load a free **Mapillary** street-level photo (free API, OSM-backed) when the user clicks "see street view"
- Migration to null out existing `street_view_url` values (and remove the API key from any cached HTML)

---

## You also need to do these 2 things in Google Cloud Console (1 minute each)

I can't do these — they require your Google account login:

1. **Set quota limits** (hard ceiling, even if my code has a bug):
   - APIs & Services → Quotas
   - Address Validation API → set requests/day to **500**
   - Places API → set requests/day to **100**
   - Maps Static / Street View → set requests/day to **200**

2. **Set a billing budget alert**:
   - Billing → Budgets & alerts → Create budget → $20/mo, alerts at 50%/90%/100%
   - This won't auto-stop charges but you'll get an email before it gets out of hand again

---

## Files I'll touch

**New (4):**
- `supabase/functions/_shared/google-budget-gate.ts`
- `supabase/functions/_shared/free-geocode.ts` (Census + Nominatim)
- `supabase/functions/_shared/free-places.ts` (Overpass + Yelp)
- `supabase/migrations/<ts>_google_budget_and_streetview_cleanup.sql` (creates tables, nulls street_view_url, RLS)

**Modified (~12):**
- `_shared/anti-hallucination.ts` — waterfall `validateAddress`
- `trade-radar-scanner/index.ts` — drop street_view_url generation
- `mortgage-radar-scanner/index.ts` — same
- `techalert-prospect-hunter/index.ts` — Overpass first, Places fallback
- `channel-prospector/index.ts`, `contractor-prospector/index.ts` — same pattern
- `b2b-dental-scraper/index.ts`, `b2b-industrial-scraper/index.ts` — same
- `enrich-supply-buyers/index.ts`, `cold-email-rank-buyers/index.ts` — same
- `industry-pulse-scanner/index.ts`, `missed-call-prospect-scanner/index.ts` — same
- Frontend `TradeRadarLeadCard.tsx` (and Mortgage equivalent) — replace Street View `<img>` with "View on Google Maps" link

**New admin page (1):**
- `src/pages/AdminGoogleSpend.tsx` — shows today's calls, MTD spend, projected monthly, kill switch toggle

---

## Expected outcome

| Metric | Before | After |
|---|---|---|
| Address Validation calls/day | ~10,000 | ~500 (hard quota) |
| Places API calls/day | ~1,000 | ~100 |
| Street View image loads | ~3,000 | 0 (replaced with free Maps link) |
| Monthly Google bill | ~$1,000 | **<$15** |
| Lead quality | Same | Same (Census is actually MORE accurate for US addresses than Google) |

Approve this and I'll ship layers 1 + 4 first (immediate bleeding stop — within minutes), then layers 2 + 3 (the proper free-source migration) right after.