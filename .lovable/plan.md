# Scanner Upgrade — 20 New Free/No-Key Sources Per Main Product

## Goal
Add 20 new data sources to each main scanner. Constraint: **zero new API keys from Matt** — only sources usable with what's already in Supabase secrets, or fully open (no auth / public APIs / scrapeable via existing Firecrawl key).

## What "main products" means here

Lead-generating scanners (11):
1. **Trade Radar** — 11 verticals share scanner; sources go into `_shared/trade-signals/signals-*.ts`. Treated as ONE product (sources distributed across verticals where relevant).
2. **Mortgage Radar** — `mortgage-radar-scanner`
3. **TechAlert** (talent intel) — `techalert-prospect-hunter`
4. **Demand Radar** — `demand-radar-enhanced-scan`
5. **Buyer Radar / Industry Pulse** — `industry-pulse-scanner`
6. **Dead Lead Pool** — `dead-lead-pool-refresh`
7. **Counsel Records Search** — `counsel-search` + `_shared/counsel-sources/*`
8. **Channel Prospector** (customer targeting) — `channel-prospector`
9. **Outreach Leads Enrichment** (email/owner waterfall) — `_shared/email-waterfall.ts` chain
10. **SiteRadar Visitor Enrichment** — `visitor-identify` (IP→company, no scanner cron, but enrichable)

= **10 product surfaces × 20 sources = 200 sources.**

## Reality check on volume

200 net-new integrations in one pass = high risk of breakage and bloat. Recommend phased delivery:

- **Phase A (this turn):** Build the source catalog (200 entries with URL, auth model, parser sketch, target product) and ship batch 1: **40 highest-ROI sources** (4 per product) with full code + wiring. Verify they return data.
- **Phase B (next turn):** Batches 2–5 = remaining 160 sources, 40 per turn.

If you'd rather I just blast all 200 in one go without verification, say so and I will — but I'll warn that 30–50% are likely to silently fail and need a follow-up sweep.

## Phase A deliverables (this turn)

### Source catalog
New file `knowledge/scanner-source-catalog-2026.md` listing all 200 sources organized by product, with:
- URL + auth model (none / existing key)
- Data shape + parser approach
- Mapped signal type / target table
- Implementation tier (1=easy ArcGIS-style JSON, 2=HTML scrape via Firecrawl, 3=multi-step)

### Code: 40 sources shipped (4 per product)

**Trade Radar (4 new, distributed across verticals)**
- USDA Drought Monitor county-level (already have D1+ — extending to per-county breakdown for HVAC + foundation)
- USGS Water Services water level alerts (foundation, restoration)
- NWS Severe Thunderstorm Watch zones (gutters, roofing)
- Detroit ArcGIS `bseed_business_licenses` — new business openings (commercial HVAC/electrical/plumbing)

**Mortgage Radar (4 new)**
- USPS NCOA-equivalent: USPS Vacant Address dataset via HUD (per-ZIP vacancy %)
- US Census Building Permits Survey (new construction velocity)
- BLS Local Area Unemployment (refi pressure indicator)
- Realtor.com price-cut RSS by ZIP

**TechAlert (4 new)**
- USA.gov contractor data (FedScope SAM expansions)
- BLS Quarterly Census of Employment & Wages (NAICS hiring trends)
- USAJobs API (federal trade postings — competitor for talent)
- ProPublica Nonprofit Explorer (Form 990 leadership turnover)

**Demand Radar (4 new)**
- BidNet Direct RSS feeds (per-state)
- DemandStar bid summaries
- MITN-equivalent: Michigan public bid postings ArcGIS
- USAspending.gov contract opportunities API

**Buyer/Industry Pulse (4 new)**
- BLS Employment Situation by metro
- Census Business Formation Statistics weekly
- FRED economic indicators (housing starts, durable goods)
- LinkedIn company growth via existing token (already have)

**Dead Lead Pool (4 new)**
- Detroit BSEED contractor registry (already partially mined — extend to license-expiration soon set)
- Michigan LARA active builder list
- Better Business Bureau accredited member directory (Michigan, scrape)
- Google Places "permanently closed" filter (re-engage owners with new ventures)

**Counsel Records Search (4 new)**
- Michigan Department of Licensing & Regulatory Affairs disciplinary actions RSS
- Michigan Attorney Discipline Board public orders
- US Tax Court opinions search
- Federal Election Commission individual contributions (lawyer political profile)

**Channel Prospector (4 new)**
- OpenStreetMap Overpass API (trade businesses by Michigan polygon)
- Wikidata SPARQL (Michigan companies by industry)
- Michigan Secretary of State business entity filings
- Detroit Open Business Registry (already have — extending to all 6 trade NAICS)

**Email/Owner Waterfall (4 new)**
- DNS TXT records (SPF often contains email infrastructure clues)
- Whois API via existing pattern (registrant email — public for many older domains)
- Schema.org `org:email` JSON-LD parser (new)
- Sitemap.xml → contact-page discovery (already partial — add multi-language paths)

**SiteRadar Visitor Enrichment (4 new)**
- IPAPI.co free tier (no key, 1k/day) — fallback ASN lookup
- AbuseIPDB free reputation (no key needed for low volume)
- DNS reverse lookup (PTR records) — corporate IPs often resolve to company subdomain
- BGP.tools ASN-to-company mapping (free JSON endpoint)

### Files touched (Phase A)
- `knowledge/scanner-source-catalog-2026.md` (new, ~200 entries)
- `supabase/functions/_shared/trade-signals/signals-{hvac,foundation,gutters,roofing}.ts` — 4 new sources
- `supabase/functions/mortgage-radar-scanner/index.ts` — 4 new sources
- `supabase/functions/techalert-prospect-hunter/index.ts` — 4 new sources
- `supabase/functions/demand-radar-enhanced-scan/index.ts` — 4 new sources
- `supabase/functions/industry-pulse-scanner/index.ts` — 4 new sources
- `supabase/functions/dead-lead-pool-refresh/index.ts` — 4 new sources
- `supabase/functions/_shared/counsel-sources/{michigan,federal,regulatory}.ts` — 4 new sources
- `supabase/functions/channel-prospector/index.ts` — 4 new sources
- `supabase/functions/_shared/email-extras-6.ts` (new) — 4 new waterfall tiers + wired into `email-waterfall.ts`
- `supabase/functions/visitor-identify/index.ts` — 4 new enrichment fallbacks
- Deploy edge functions after batch

### Verification
- After ship: curl each scanner once, count new-source rows in DB, fix any zero-result sources before declaring done.

## Phase B+ (future turns)
- 40 more sources per turn × 4 turns
- Same verification gate per batch

## Constraints
- No new secrets requested.
- Sources that turn out to require auth get dropped from the list and noted in the catalog with reason.
- All scrapes go through existing `FIRECRAWL_API_KEY` (already in Supabase).
- All county GIS sources use try/catch fail-graceful pattern (per Phase 42 lessons).

## Risk
- ~30% of "free" sources will silently rate-limit or return empty in production. Mitigated by per-batch verification.
- Schema growth: adding 200 sources means 200 new signal-type strings — will keep them grouped under existing signal types where possible to avoid digest bloat.
