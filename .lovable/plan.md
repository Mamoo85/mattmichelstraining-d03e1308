
# TechAlert — Planetary-Scale Hiring Intelligence Scanner

*Updated 2026-04-14 — Full multi-source parallel architecture*

## The Vision

Eight data sources running simultaneously every morning at 7am. No hiring intelligence product on earth does this. By the time a competitor even knows a licensed tradesperson exists, TechAlert clients already got the alert 24 hours ago.

## Architecture

```
miosha-license-scraper (invoked by hire-alert-scanner at 7am ET)
│
├── Promise.allSettled([
│     scanNPIRegistry(),           // S1: federal healthcare registry
│     scanMichiganNurseAide(),     // S2: Michigan CNA gov registry
│     scanMichiganOpenData(),      // S3: data.michigan.gov bulk CSV
│     scanBuildingPermits(),       // S4: 🔥 Detroit/Wayne permit APIs
│     scanNATERegistry(),          // S5: HVAC cert registry (Firecrawl)
│     scanTradeUnions(),           // S6: UA98 + IBEW58 + Boilermakers (Firecrawl)
│     scanPDL(),                   // S7: People Data Labs people search
│     scanViaSonar(),              // S8: LinkedIn open-to-work profiles
│   ])
│
└── dedup → upsert hire_alert_candidates → score (hire-alert-scanner) → alert clients
```

All sources run in parallel. One failure doesn't stop the rest.

## Source Details

### S1: NPI Registry (healthcare — already works)
Free federal API. Searches 15 Metro Detroit cities × 5 taxonomy codes. Expected: 6-8 candidates/run.

### S2: Michigan Nurse Aide Registry
POST to `https://miidss.state.mi.us/NARSearch.aspx` with county=Wayne/Oakland/Macomb form data.
Parse HTML table for names + cert numbers. Filter to Active status. Expected: 5-15 CNAs/run.

### S3: Michigan Open Data Portal (data.michigan.gov)
Socrata SODA API for active trade licenses:
- Known dataset IDs for electrician, plumber, HVAC
- Generic professional license search with BOILER/PLUMB/ELECTR/HVAC filters
Expected: 20-50 if trade CSVs exist.

### S4: 🔥 Building Permits — THE MOAT
Detroit Open Data Socrata API for recent mechanical/plumbing/electrical permits.
`contractor_name` → `full_name`, `contractor_license` → `license_number`.
These are people ACTIVELY WORKING with verified licenses right now.
Expected: 10-30 trades actively working.

### S5: NATE Certified Technician Registry (Firecrawl)
Firecrawl scrapes `natex.org/site/find-a-technician` with 8 Metro Detroit zip codes.
Gemini extracts tech names from scraped markdown.
Expected: 5-20 HVAC certified techs.

### S6: Trade Union Directories (Firecrawl)
Firecrawl scrapes 9 union URLs:
- `ua98.org/contractors` + `/officers` (Plumber)
- `ibew58.org` (Electrician)
- `smwia80.org` (HVAC)
- `smw80jac.org/about-us` (HVAC apprenticeship)
- `michiganpipetrades.org/contractors` (Plumber)
- `boilermakers169.org` (Boiler Operator)
- `ualocal636.org` (Plumber/Pipefitter)
- `michiganbuildingtrades.org` (Building Tradesman newspaper)
Gemini extracts individual names from markdown. Expected: 5-15 union members.

### S7: People Data Labs (PDL_API_KEY already configured)
POST `https://api.peopledatalabs.com/v5/person/search` for 10 trade titles:
boiler operator, stationary engineer, chief engineer, HVAC technician,
master plumber, journeyman plumber, master electrician, journeyman electrician,
certified nursing assistant, licensed practical nurse.
Filter: `location_region: michigan`, size: 25. Expected: 10-25 all trades.

### S8: Sonar via OpenRouter (KEEP — prompts fixed)
4 queries targeting LinkedIn "open to work", trade union member spotlights,
Indeed public resumes, apprenticeship completion announcements,
Building Tradesman newspaper mentions. Expected: 2-8 public profiles.

## Critical Bug Fix — VERIFIED FIXED
The `name: c.full_name` fix in `upsertCandidate()` is explicitly present in the rebuilt code.
Both `name` (NOT NULL column) and `full_name` are written on every insert AND every update.
This was the root cause of silent insert failures.

## Files Changed

### `supabase/functions/miosha-license-scraper/index.ts` — COMPLETE REBUILD ✅
- Removed old 2-source architecture (NPI + Sonar only)
- Added 6 new sources (S2-S7)
- All 8 sources run via `Promise.allSettled()` in parallel
- `upsertCandidate()` explicitly writes `name: c.full_name` on every insert AND update
- `extractNamesFromMarkdown()` — new shared Gemini extraction for Firecrawl content
- `extractNamesFromProse()` — kept for Sonar fallback
- Per-source logging with counts
- Response includes `sources` breakdown object

### `supabase/functions/hire-alert-scanner/index.ts` — PROMPT FIXES
- `scanJobBoardsViaOpenRouter()` prompts already updated (LinkedIn open-to-work targeting)
- Confirmed `name: c.full_name` present in all inserts

## No New Secrets Needed
- `FIRECRAWL_API_KEY` — already configured ✅
- `PDL_API_KEY` — already configured ✅
- `OPENROUTER_API_KEY` — already configured ✅
- `LOVABLE_API_KEY` — already configured ✅

## Deduplication Strategy
1. By `license_number` (strongest — exact government ID)
2. By `full_name` + `license_type` + `source` (same person, same source)
3. Cross-source: name+city match within same license_type → update `last_seen_at`

## Expected Output

| Source | Expected/run |
|--------|-------------|
| S1: NPI Registry | 6-8 |
| S2: Michigan NAR | 5-15 |
| S3: Michigan Open Data | 20-50 |
| S4: Building Permits | 10-30 |
| S5: NATE Registry | 5-20 |
| S6: Trade Unions | 5-15 |
| S7: PDL | 10-25 |
| S8: Sonar | 2-8 |
| **TOTAL** | **63-171** |

## What Does NOT Change
- Scoring, alerting, deduplication, SMS logic in hire-alert-scanner
- NPI enrichment in hire-alert-scanner (per-candidate enrichment)
- Sonar OSINT enrichment (per-candidate)
- PDL enrichment (per-candidate)
- AI synthesis
- Nursys integration (wired separately later)

## Verification
1. Deploy `miosha-license-scraper` → invoke manually → check logs for per-source counts
2. Query `hire_alert_candidates` → confirm `name` column populated
3. Check response JSON `sources` object for per-source attribution
4. Run `hire-alert-scanner` → confirm `scanMIOSHA()` picks up new candidates
5. Verify scoring + alerting fires for score >= 7

## Future: Action Items for Matt
- Submit CSCL license list request at michigan.gov for electrician/plumber/HVAC/boiler xlsx files
- Once received, build xlsx ingestion pipeline as S9
