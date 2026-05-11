# Scanner Source Backlog — Next 20 (Prioritized)

Scope: net-new sources beyond the 200 already live (Phases A–E + canonical schema).
Goal: highest marginal ROI per product surface, ordered by (a) lead-volume lift, (b) data freshness, (c) auth cost (free/no-key preferred).
Auth legend: **NONE** = open public endpoint · **EXISTING** = key already in Supabase secrets · **NEW** = requires Matt to add a key

---

## Tier S — Ship first (highest ROI, low auth cost)

### 1. ATTOM Property Data API — Mortgage Radar + Trade Radar
- **Data**: Owner-of-record, last sale date/price, AVM, mortgage balance estimate, equity %, lien data per address.
- **Why**: Fills the single biggest gap — equity-position scoring for refi + home-improvement targeting.
- **Auth**: **NEW** — `ATTOM_API_KEY` (free dev tier: 1k calls/day). Header: `apikey`.
- **Targets**: `mortgage_radar`, `trade_radar` (all 11 verticals), `dead_lead_pool`.

### 2. PropMix / RentCast Sales + Rental API — Mortgage Radar
- **Data**: Off-market property valuations, rent comps, distressed listings.
- **Auth**: **NEW** — `RENTCAST_API_KEY` (free 50/mo). Header: `X-Api-Key`.
- **Targets**: `mortgage_radar`, `channel_prospector`.

### 3. OpenCorporates Officer Changes — Channel Prospector + Counsel Records
- **Data**: Officer/director appointments and resignations across all MI/OH/IN/IL entities. Best decision-maker turnover signal in existence.
- **Auth**: **EXISTING** pattern (already used elsewhere); free tier 500/day no key, **OPTIONAL** `OPENCORPORATES_API_KEY` for 5k/day.
- **Targets**: `channel_prospector`, `counsel_records`, `dead_lead_pool`.

### 4. Twilio Lookup v2 Line Type Intelligence — Email Waterfall + Dead Lead Pool
- **Data**: Phone → carrier, line type (mobile/landline/VoIP), DNC flag, caller name (CNAM).
- **Auth**: **EXISTING** — `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`. ($0.008/lookup).
- **Targets**: `email_waterfall` (phone validation step), `dead_lead_pool` (already wired to D1 SMS — extend to D0 contact qualification).

### 5. Google Places Nearby + Details (Tier-2 NAICS expansion) — Channel Prospector
- **Data**: Business name, place_id, phone, website, hours, ratings, "permanently_closed" flag for 20 NAICS we don't yet hit (HVAC distributors, plumbing supply, roofing wholesalers, electrical supply).
- **Auth**: **EXISTING** — `GOOGLE_MAPS_API_KEY`.
- **Targets**: `channel_prospector`, `dead_lead_pool` (closed flag).

### 6. NWS Watches/Warnings Polygons Stream — Trade Radar
- **Data**: Real-time polygon intersection (hail, flood, wind) at lat/lon, not just county. 5–15 min latency.
- **Auth**: **NONE** (api.weather.gov, User-Agent header only).
- **Targets**: `trade_radar` (roofing, gutters, exterior, restoration, foundation, tree).

### 7. FCC ULS Daily Updates — TechAlert + Channel Prospector
- **Data**: New radio/wireless licenses (proxy for new field-service ops, fleet expansion). Daily delta zips.
- **Auth**: **NONE** (FTP/HTTP public download).
- **Targets**: `techalert`, `channel_prospector`.

### 8. CourtListener RECAP Docket Alerts — Counsel Records + Mortgage Radar
- **Data**: Real-time PACER docket entries (foreclosure, bankruptcy, lien enforcement) — push via webhook, no polling.
- **Auth**: **EXISTING** — `COURTLISTENER_API_KEY` (already noted in Phase 42).
- **Targets**: `counsel_records`, `mortgage_radar`, `dead_lead_pool`.

### 9. Snov.io Domain Search (extend existing key) — Email Waterfall
- **Data**: All emails on a domain, role-typed (owner/manager/admin), verified.
- **Auth**: **EXISTING** — `SNOV_USER_ID` / `SNOV_API_KEY`.
- **Targets**: `email_waterfall` (currently only used at one tier — promote to bulk domain harvest).

### 10. HIBP Breach + Pwned Passwords — SiteRadar + Email Waterfall
- **Data**: Email breach exposure (signals account is real + active in last 5y).
- **Auth**: **EXISTING** — `HIBP_API_KEY`.
- **Targets**: `email_waterfall` (verification step), `siteradar_visitor` (account-takeover risk overlay).

---

## Tier A — Ship second (good ROI, mostly free)

### 11. USPS Address Standardization + ZIP+4 — Canonical Places
- **Data**: Standardized address, ZIP+4, DPV (deliverability) flag, vacant-address flag.
- **Auth**: **NEW** — `USPS_USER_ID` (free; OAuth registration).
- **Targets**: `canonical_places` normalization, `mortgage_radar`, `trade_radar`.

### 12. Melissa Property + Personator (free tier) — Mortgage Radar
- **Data**: 25 free property lookups/mo (owner, mortgage, AVM).
- **Auth**: **NEW** — `MELISSA_LICENSE_KEY` (free dev).
- **Targets**: `mortgage_radar`.

### 13. RealtyMole Property API — Trade Radar
- **Data**: Property characteristics (sqft, year built, bed/bath) — fills gaps where county GIS is blocked.
- **Auth**: **NEW** — `REALTYMOLE_API_KEY` (RapidAPI free tier).
- **Targets**: `trade_radar` (all verticals where age/size scoring is used).

### 14. LinkedIn Sales Navigator Lead List Export (via existing token) — TechAlert + Channel Prospector
- **Data**: Job-change events, promotion alerts, posted-about-hiring signals.
- **Auth**: **EXISTING** — `LINKEDIN_ACCESS_TOKEN` (extend scope).
- **Targets**: `techalert`, `channel_prospector`, `email_waterfall`.

### 15. Reddit PRAW (geo + trade subreddits) — Demand Radar + Dead Lead Pool
- **Data**: "Looking for HVAC in Detroit" type posts. Buyer-intent on the open web.
- **Auth**: **NEW** — `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` (free script-app).
- **Targets**: `demand_radar`, `dead_lead_pool`, `trade_radar`.

### 16. Nextdoor Business Recommendations (Firecrawl) — Demand Radar
- **Data**: Neighborhood-level service requests and recommendations posts.
- **Auth**: **EXISTING** — `FIRECRAWL_API_KEY` (scrape).
- **Targets**: `demand_radar`, `channel_prospector`.

### 17. Detroit DPD Police Incident Reports (ArcGIS) — Trade Radar (restoration) + Dead Lead Pool
- **Data**: Vandalism, B&E, fire-arson incidents per address. Restoration + board-up triggers.
- **Auth**: **NONE**.
- **Targets**: `trade_radar` (restoration, demo_junk), `dead_lead_pool`.

### 18. EPA ECHO Enforcement & Compliance — Industry Pulse + Counsel Records
- **Data**: Facility-level violations, fines, RCRA/CAA/CWA actions. Financial-distress signal.
- **Auth**: **NONE**.
- **Targets**: `industry_pulse`, `counsel_records`, `dead_lead_pool`.

### 19. SimilarWeb Free Domain Insights (Firecrawl) — SiteRadar
- **Data**: Traffic estimate, top sources, competitor overlap — for visitor-company qualification.
- **Auth**: **EXISTING** — `FIRECRAWL_API_KEY`.
- **Targets**: `siteradar_visitor`, `channel_prospector`.

### 20. Michigan SOS Real-Time Entity Filings Feed — Channel Prospector + Dead Lead Pool
- **Data**: Daily new LLCs/Corps + dissolutions with registered-agent + officer contacts.
- **Auth**: **NONE** (public bulk CSV; weekly drop).
- **Targets**: `channel_prospector`, `dead_lead_pool`, `counsel_records`.

---

## Auth summary

| Auth status | Count | Sources |
|---|---|---|
| **NONE** (open) | 6 | #6, #7, #17, #18, #20, plus #3 free tier |
| **EXISTING** (no new keys) | 7 | #4, #5, #8, #9, #10, #14, #16, #19 |
| **NEW** keys needed | 7 | #1 ATTOM, #2 RentCast, #11 USPS, #12 Melissa, #13 RealtyMole, #15 Reddit, (#3 OpenCorporates optional) |

**Recommended ask to Matt**: register for ATTOM, RentCast, USPS, Reddit — these unlock 9 of the top 20. All are free dev tiers; ~30 min total signup.

---

## Implementation notes

- All 20 will be wired into the canonical schema via `scanner_source_mappings` (no parser code in consumers — only in `_shared/canonical-mapper.ts` field_map rules).
- Each source gets a `default_score` 1–10 and `target_products` array on registration; admin UI at `/dwa-admin/scanner-sources` will surface health on the existing dashboard.
- Phase plan: Tier S (10 sources) in two batches of 5, Tier A (10 sources) in two batches of 5. Verify per batch with `scanner-extras-verify`.
