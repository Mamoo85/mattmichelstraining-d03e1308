## Resource Audit — What We're Already Paying For (and Barely Using)

I pulled the full secret + connector inventory. We have **85 secrets and 12 live connectors**. The previous plan only used ~30% of them. The new architecture wires in every paid resource we already own before adding anything new.

### Tier A — Paid B2B Contact Databases (we own, barely use)
| Resource | What it gives us | Current usage |
|---|---|---|
| **APOLLO_API_KEY** | 275M contacts, org search, email reveal | ✅ used (waterfall stage 2) |
| **HUNTER_API_KEY** | Domain → email finder/verify | ✅ used (stage 5) |
| **SNOV_API_KEY** + CLIENT | Email finder + drip + LI scrape | ✅ used (stage 1) |
| **PDL_API_KEY** (People Data Labs) | 3B person records, work email reveal | ⚠️ stage 6 only — should be stage 2 |
| **CLAY_API_KEY** | Multi-source waterfall + AI enrich | ❌ **unused** |
| **CRUSTDATA_API_KEY** | LinkedIn firmographics + headcount signals | ❌ **unused** |
| **LUSHA_API_KEY** | Direct dials + verified work emails | ❌ **unused** |
| **DATAFORSEO** (login+pwd) | LinkedIn SERP, Google Maps grid, contact scrape | ⚠️ Maps only |

### Tier B — Paid Scraping Infrastructure (we own, barely use)
| Resource | What it gives us | Current usage |
|---|---|---|
| **APIFY_API_TOKEN** | 2,000+ pre-built scrapers (LI Sales Nav, FB Pages, IG, Yelp reviews, Google Maps, Indeed, ZoomInfo) | ❌ **unused** |
| **BROWSERLESS_API_KEY** | Headless Chrome for any site | ⚠️ PDF only |
| **FIRECRAWL** (connector) | AI scraper, search, map, crawl | ✅ used |

### Tier C — Channel/Identity APIs (we own)
| Resource | Use |
|---|---|
| **LINKEDIN_ACCESS_TOKEN** + CLIENT | LI Marketing API, lead gen forms, company lookup |
| **META_ACCESS_TOKEN** + APP/PAGE | FB Pages, Graph search, lead ads |
| **YELP_API_KEY** | Business search (3M+ US biz) |
| **GOOGLE_MAPS_API_KEY** | Places (Nearby Search, 60k/day free tier) |

### Tier D — Specialty/Domain Data (we own)
ATTOM, RENTCAST (property), ACCELA (permits nationwide), NMLS, NURSYS, PACER, FRED, BLS, FINRA, SAM.gov, SEC EDGAR, USPTO, DOL, NOAA, HIBP, GITHUB_PAT.

### Verdict
The previous "Phase 3 — 5,000 inboxes" plan was leaving **CLAY, CRUSTDATA, LUSHA, APIFY, LinkedIn-API, Meta-API, and Yelp** on the bench. With those wired in we don't need to invent new scrapers — we already paid for them.

---

## Revised Architecture — "Resource-First Buyer Engine"

```text
                     ┌─────────────────────────────────┐
                     │ buyer-universe-orchestrator     │  cron: every 30 min
                     │ (picks pool + source by quota)  │
                     └────────────┬────────────────────┘
                                  ▼
   ┌─────────────────┬──────────────────┬─────────────────┬──────────────────┐
   │ DISCOVERY LANES │                  │                 │                  │
   ├─────────────────┴──────────────────┴─────────────────┴──────────────────┤
   │ L1 Government    L2 Directories    L3 Paid B2B DBs   L4 Scraped Web     │
   │ NPI/CMS/AHA      Yelp/Google Maps  Apollo/Crustdata  Apify (LI/FB/IG)   │
   │ NMLS/SAM/LARA    BBB/Manta         PDL/Clay/Lusha    Firecrawl/Browserls│
   │ NURSYS/USPTO     DataForSEO Local  HubSpot CRM       SERP scrape        │
   └─────────────────┬─────────────────┬─────────────────┬──────────────────┘
                     ▼                 ▼                 ▼
                ┌────────────────────────────────────────────┐
                │  raw_buyer_candidates (staging)            │
                └────────────┬───────────────────────────────┘
                             ▼
                ┌────────────────────────────────────────────┐
                │  unified-enrichment-waterfall (10 stages)  │
                │  Apollo → Crustdata → Lusha → PDL → Clay   │
                │   → Hunter → Snov → Firecrawl → Apify-LI   │
                │   → SERP/site-scrape                       │
                └────────────┬───────────────────────────────┘
                             ▼
                ┌────────────────────────────────────────────┐
                │  buyer_pools (per-product, sharded)        │
                │  + dedupe, NeverBounce-style verify        │
                └────────────┬───────────────────────────────┘
                             ▼
                ┌────────────────────────────────────────────┐
                │  cold-email-pool-router                    │
                │  warm-up ramp, per-domain throttle,        │
                │  bounce kill-switch, quality gate ≥7/10    │
                └────────────────────────────────────────────┘
```

---

## Pool Targets & Source Mix (revised — every paid resource pulled in)

| # | Pool | Target Inboxes | Source Stack |
|---|---|---|---|
| 1 | **Staffing/Recruiting agencies** (Nurses, Tech, Allied Health buyers) | 3,000 | Apollo + Crustdata (firm size filter) + **Apify "LinkedIn Sales Navigator scraper"** + Yelp + DataForSEO LI SERP + BBB |
| 2 | **Hospital HR / nurse managers** | 1,200 | NPI Registry + AHA + CMS + **Apify "Hospital admin scraper"** + Lusha direct dials |
| 3 | **Trade contractors** (Mortgage Radar buyers + reseller targets) | 2,500 | Google Places grid + DataForSEO Local Pack + Yelp + LARA + **Apify "Google Maps emails+phones"** + Firecrawl on each website |
| 4 | **Mortgage LOs / brokers** | 1,000 | NMLS + Apollo + Crustdata + **Apify "LinkedIn LO scraper"** + Lusha |
| 5 | **Property managers / landlords** | 1,000 | LARA + Detroit rental regs + Yelp PM category + Apollo + **Apify FB Group scraper** (landlord groups) |
| 6 | **NEW — Real estate brokerages & teams** (Mortgage Radar + dead-lead resellers) | 800 | Apollo + Yelp + DataForSEO + Crustdata |
| 7 | **NEW — Dental/medical practice owners** (FieldDesk + Missed-Call buyers) | 600 | NPI + Yelp + Google Maps + Apollo |
| 8 | **NEW — Auto repair / multi-loc service biz** (FieldDesk + Missed-Call) | 600 | Yelp + Google Maps + DataForSEO |

**Total daily inbox capacity: ~10,700** (cap actual sends at 500–1,000/day to stay under spam thresholds; rotate pools).

---

## What If We Still Can't Fill It? (Brainstorm — fallbacks ranked by likelihood)

If a pool comes back thin after the full waterfall, the orchestrator escalates in this order:

1. **Apify on-demand actor run** — spin up "LinkedIn Sales Navigator Scraper" or "Facebook Pages Scraper" with the exact ICP filter; pay $0.25–$1/1k records. Fully automated, no human required.
2. **Crustdata firmographic widen** — drop a filter (e.g., headcount 11–50 → 11–200), re-pull.
3. **DataForSEO LinkedIn People Search** — pulls public LI profiles by title/location; we own the credits.
4. **Reverse-source from existing leads** — if we have a hospital lead, scrape its "leadership team" page via Firecrawl + Apify.
5. **HubSpot CRM mining** — we have a HubSpot connector linked. Pull every contact, score for ICP fit.
6. **Referral/partner expansion** — auto-DM 5 connections per buyer email reply asking "who else should we talk to" (Slack/email template).
7. **LinkedIn Marketing API** — use our LINKEDIN_ACCESS_TOKEN to query company pages → extract employee counts, run lead gen form ads automatically.
8. **Meta Graph API** — Pull Page admins of trade/landlord/staffing FB groups via META_ACCESS_TOKEN.
9. **Last resort — paid list buy** — Clay + ZoomInfo free tier already in waterfall; if all else fails, alert Matt with a single SMS: *"Pool X stuck at N inboxes after 9 fallbacks. Approve $X for one-time list buy?"*

The system should **never silently return zero**. Every empty pool = automatic SMS to Matt with the audit trail.

---

## What I'll Build (4 Phases — same shape as before, expanded)

### Phase 1 — Source bug fixes (15 min)
- FEMA `$filter` syntax bug
- NOAA `?limit=` bug
- LARA COFS SSL → Firecrawl fallback
- Census ACS already has key ✅

### Phase 2 — Fill 4 sparse PRODUCT tables
`contractor_leads` 24→500+, `marketplace_prospects` 50→500+, `dead_lead_contacts` 0→1000+, `hire_alert_candidates` 396→1500+ — using same Apollo/Apify/Firecrawl waterfall.

### Phase 3 — Build 8 buyer pools to ~10k total addressable, 500–1k sends/day
- New table: `raw_buyer_candidates` (staging, dedupe key on domain+email)
- New table: `buyer_pools` (per-product sharding, scored, verified)
- New function: `buyer-universe-orchestrator` (cron 30 min, picks pool+source by quota gap)
- New function: `unified-enrichment-waterfall-v2` (10 stages, Clay+Crustdata+Lusha added)
- New function: `apify-actor-runner` (generic Apify trigger; reads actor config from `apify_actor_jobs` table)
- New function: `cold-email-pool-router` (warm-up ramp 50→500/day over 14 days, per-domain cap 1/week, hard bounce kill-switch at 2%)
- 8 scored cold-email templates (one per pool), all with unsubscribe + manual opt-out hook

### Phase 4 — Observability
- New admin page: `BuyerUniverseDashboard` — per-pool size, fill rate, source mix, send volume, bounce rate, reply rate
- Daily 7am SMS to Matt: pool sizes + any pool that didn't hit fill target + any source that failed

---

## Open Questions Before I Build

1. **Apify cost ceiling** — Apify charges per actor run (~$0.25–$1 per 1,000 records). OK to set a daily budget of **$25/day** ($750/mo)? At target volume that's ~25k–100k records/day across all actors.
2. **Clay** — same question. Clay is ~$0.10 per enriched row. Daily cap of **$20/day**?
3. **Which 2 NEW pools first** (Real Estate, Dental, Auto Repair) — pick all 3, or sequence them?
4. **Send ramp aggressiveness** — Resend can handle 500/day per domain comfortably from cold. Want me to ramp 50→500 over 14 days (safe), or 100→500 over 7 days (faster, slightly higher bounce risk)?

Once you answer (or say "you decide"), I execute all 4 phases in one go.