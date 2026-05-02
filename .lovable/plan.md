## The Big Build: Autonomous Target Discovery Engine + 50 New Free Data Sources

Replace the CSV uploader with a real prospecting engine, AND add 50 free / no-key data sources that power every radar we have (Mortgage Radar, TechAlert/Hire Radar, Talent Radar, Contractor Leads, SiteRadar, Marketplace) — with multi-state coverage so we can advertise out-of-state with credibility.

---

### PART A — Autonomous Target Discovery Engine

**1. New edge function: `outreach-target-discover`**
The brain. Input: `{ verticals, states, cities?, limit, channel_intent, min_confidence, exclude_existing, exclude_founders }`.

Pipeline per (vertical × city), parallel batches of 5:
1. **Discover** — Google Places + DataForSEO Local Pack (parallel), dedupe by name+zip
2. **Cross-check** with state license boards (50 sources below)
3. **Enrich owner** — `email-waterfall.ts` + `firecrawl.ts extractFaxNumber()`
4. **Compliance scrub** — DNC, founder-seats, landline-on-sms
5. **Score & insert** — only insert if channel-required field resolved + confidence ≥ threshold
6. **Audit trail** — every step written to `enrichment_data.discovery_trace`

Returns full breakdown: discovered / enriched / inserted / skipped (dupe, compliance, low-conf) / cost.

Guardrails: $50/run cap (configurable), all DB awaits, fail-fast on missing keys, structured errors.

**2. New edge function: `outreach-target-enrich-backfill`** — cron every 6h, drains rows with missing channel field and retries enrichment (mirrors `contractor-outreach-enrich-backfill`).

**3. New table: `outreach_target_recipes`** — saved searches (criteria jsonb + optional cron schedule + last_run stats). pg_cron auto-fires scheduled recipes.

**4. UI replacement: `Wave5OutreachConsole.tsx` → Targets tab**
```text
┌─ Discover Targets ─────────────────────────────┐
│ Verticals  [roofing][plumbing][hvac][+]        │
│ States     [MI][OH][IN][TX][FL][+]             │
│ Cities     auto · or pick: [Detroit][Cleveland]│
│ Channel    ( ) email ( ) fax ( ) postcard      │
│ Limit [200]   Min confidence [40]              │
│ ☑ Skip dupes  ☑ Skip founders  ☑ Cross-license │
│                                                │
│ Est cost ~$3.40 · [Run] [Save Recipe] [Daily]  │
└────────────────────────────────────────────────┘

Live trace (polls 2s): Discovered 187 · Enriched 142 · Inserted 118
Skip — dupe 41 · compliance 8 · low-conf 20
Provider hits: Apollo 142 · Hunter 67 · Firecrawl 33 · License board 89

Saved recipes: [MI roofers fax] [OH plumbers email] [TX HVAC postcard]
```

**5. Wire into campaign launcher** — "Auto-discover fresh targets before send" toggle.

---

### PART B — 50 New Free/No-Key Data Sources (organized by radar)

Each source = one shared helper in `supabase/functions/_shared/sources/<source>.ts` returning a normalized shape. All free or open APIs (no keys we don't already have). State coverage noted.

**Mortgage Radar / Real Estate (12 sources)** — beyond Michigan
1. **HUD User Datasets** — fair-market rent, distressed properties, all 50 states
2. **FFIEC HMDA** — mortgage origination data, all states, free API
3. **Census ACS Housing API** — owner-occupancy, value, vacancy by tract, all states
4. **FEMA Disaster Declarations API** — storm/flood/fire = motivated sellers, all states
5. **USPS Vacant Address List** (via HUD) — vacancy by zip, all states
6. **OpenAddresses.io** — bulk address parcels, 30+ states
7. **Zillow Research CSVs** — ZHVI, ZORI, days-on-market by zip, all states (downloadable)
8. **Realtor.com Research CSVs** — inventory + price reductions by metro, all states
9. **NOAA Storm Events DB** — hail/wind events past 7 days (insurance-restoration radar)
10. **EPA Lead Service Line Inventory** — water-line replacements driving home sales
11. **OpenSecrets PAC contributions by zip** — high-net-worth signal for jumbo loans
12. **county GIS REST endpoints** (Wayne, Cuyahoga, Cook, Harris, Maricopa, Miami-Dade) — parcel + permit + tax-delinquent

**TechAlert / Hire Radar (10 sources)** — signal scanning, all states
13. **DOL CareerOneStop API** — registered apprenticeships by state, free key
14. **BLS Quarterly Census of Employment & Wages** — industry growth by county, all states
15. **OSHA Establishment Search** — recent inspections = compliance pain (HVAC/electrical)
16. **EPA ECHO Enforcement** — environmental enforcement = facility upgrades coming
17. **state SOS new business filings RSS** — MI, OH, IN, IL, TX, FL, GA, NC, PA, AZ, CA all publish
18. **Federal Audit Clearinghouse** — Single Audit findings = nonprofit/government hiring signals
19. **FBO/SAM.gov Opportunities** (already keyed) — *expand* to all NAICS, awarded → losing bidders need talent
20. **DOL WARN Notices** by state — layoffs (poaching list for talent radar)
21. **NAICS Association free directory** — industry classification cross-walk
22. **GitHub Search API** (already used for HVAC) — *expand* to construction tech, healthcare IT, fintech

**Talent Radar (8 sources)** — candidate enrichment
23. **CMS NPI Registry** (already used) — *expand* to all healthcare professions, all states
24. **ABMS Certification Matters** — board-certified physician verification
25. **state nursing board APIs** — MI, OH, FL, TX, CA, IL, PA all expose lookup endpoints
26. **state teaching license boards** — pivot for school-staffing radar
27. **state bar association directories** — all 50 expose member lookup
28. **state CPA license boards** — finance talent radar
29. **PE/SE engineering license boards** — NCEES national database
30. **VA Provider Database** — federal medical licensure cross-ref

**Contractor Leads (8 sources)** — multi-state expansion
31. **state contractor license lookups** — TX TDLR, FL DBPR (already), CA CSLB, AZ ROC, NV NSCB, OR CCB, WA L&I, GA SLB
32. **county building permit ArcGIS REST endpoints** — *catalog 30 counties* across MI/OH/IN/IL/TX/FL/GA/NC/AZ/NV/WA
33. **OSHA SIR severe-injury reports** — contractors with safety issues (replace/upgrade signal)
34. **EPA RRP Lead-Safe certification** — required-cert contractors (small pool, premium)
35. **DOT MCS-150 carrier registry** — fleet contractors needing fleet upgrades
36. **PHMSA pipeline operator registry** — utility contractors
37. **FCC Antenna Structure Registry** — telecom contractors
38. **NCDOT/TxDOT/etc prequalified bidder lists** — public road contractors with revenue scale

**SiteRadar / Visitor Intel (4 sources)**
39. **CIDR Report ASN database** — IP→company mapping fallback before paid Clearbit
40. **PeeringDB API** — corporate network presence enrichment
41. **CRT.sh Certificate Transparency** — domain-to-org mapping via SSL certs
42. **WHOIS via RDAP** — domain owner lookup, no key needed

**Marketplace / Lead Verification (4 sources)**
43. **state corporation filings RSS** — verify lead is a real entity
44. **EIN Verification via SEC EDGAR** — businesses with federal filings
45. **OFAC SDN List** — compliance scrub (free, mandatory)
46. **OpenCorporates free tier** — global entity lookup

**Cross-cutting / Credibility & Out-of-State Justification (4 sources)**
47. **Census Business Patterns API** — "There are X plumbers in [your county]" stat for ad copy
48. **BLS OEWS** — local wage data per occupation (justifies pricing in any state)
49. **FRED economic indicators** — state-level housing starts, unemployment, building permits aggregate
50. **Google Trends unofficial JSON** — search demand per service per metro (already used pattern)

---

### Implementation pattern (one helper per source)

Each lives at `supabase/functions/_shared/sources/<source>.ts` and exports a single typed function returning `{ data: NormalizedRow[], cost: 0, source: 'hud_fmr', fetched_at }`. All wrapped in `circuit-breaker.ts` + `fetch-with-retry.ts`. Three master indexes:
- `_shared/sources/index.ts` — re-exports + a registry: `{ source_id, radar, states_covered, refresh_interval }`
- `_shared/sources/registry.json` — JSON manifest the admin UI reads to render the source catalog
- `_shared/sources/backfill-runner.ts` — generic runner: takes source_id + params, writes to `data_source_cache` table

**One new table: `data_source_cache`** — `(source_id, key, payload jsonb, fetched_at, expires_at)`. Lets every radar query any source without re-hitting the API. RLS service-role only.

**One new admin page tab: `/dwa-admin/data-sources`** — grid of all 50 sources, status (last fetch / row count / error), manual "refresh now" button per source, state-coverage map.

---

### Files

**New edge functions:**
- `supabase/functions/outreach-target-discover/index.ts`
- `supabase/functions/outreach-target-enrich-backfill/index.ts`
- `supabase/functions/data-source-fetch/index.ts` (generic source-runner)

**New shared helpers (50):**
- `supabase/functions/_shared/sources/<source>.ts` × 50
- `supabase/functions/_shared/sources/index.ts`
- `supabase/functions/_shared/sources/registry.json`
- `supabase/functions/_shared/sources/backfill-runner.ts`

**New migrations:**
- `<ts>_outreach_target_recipes.sql`
- `<ts>_data_source_cache.sql`
- `<ts>_outreach_target_discover_cron.sql` (recipe runner + 6h backfill)

**UI:**
- `src/components/dwa-admin/Wave5OutreachConsole.tsx` (replace Targets tab)
- `src/components/dwa-admin/TargetDiscoveryPanel.tsx` (new)
- `src/components/dwa-admin/DiscoveryRecipesPanel.tsx` (new)
- `src/components/dwa-admin/DataSourcesCatalog.tsx` (new)
- `src/pages/DWAAdmin.tsx` (route)

**Config:**
- `supabase/config.toml` — register all 3 new functions, `verify_jwt = false`

---

### Cost & throughput
- All 50 sources free or use existing keys
- 200 fully-enriched targets ≈ $3–5 (Apollo/Hunter only, license boards & gov data are free)
- Daily cap $50 ≈ 2,000 fresh contacts/day
- License-board cross-check raises confidence score (more contactable leads, fewer bounces)

### Compliance
- Founder-seats.ts excludes Mitchell/Pat/Matt
- DNC scrub on insert (not just on send)
- OFAC SDN cross-ref (#45) — required for B2B
- All scraping respects robots.txt + rate limits
- Audit trail in `enrichment_data.discovery_trace` for every row

### Out of scope (explicitly)
- LinkedIn Sales Nav scraping (different auth model)
- Paid sources (Clearbit Reveal, paid OpenCorporates) — stay free this round
- Building 50 separate UIs — one catalog page covers them all

This is the build. Approving runs all of it: discovery engine + 50 sources + cache table + admin catalog + recipe scheduler.
