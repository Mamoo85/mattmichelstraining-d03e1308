

# Add 8 New Data Sources (S10–S17) to miosha-license-scraper

## Summary
Add 8 new scan functions to the existing `Promise.allSettled()` block in `miosha-license-scraper/index.ts`. Purely additive — no existing logic changes. This takes the scanner from 9 sources to 17.

## New Environment Variable Needed
- **YELP_API_KEY** — must be added via Lovable secrets before Yelp source will activate

## Sources Being Added

| ID | Source | Method | API Key | Expected Yield |
|----|--------|--------|---------|---------------|
| S10 | Michigan VAL License ID Enumeration | Direct HTML fetch + regex parse of `val.apps.lara.state.mi.us/License/Details/{id}` | None | 5–20/run |
| S11 | Craigslist RSS (sks + trd) | Plain fetch of RSS XML, parse items | None | 2–10/run |
| S12 | Yelp Fusion API | REST `businesses/search` for contractor categories across 6 Metro Detroit cities | YELP_API_KEY | 10–30/run |
| S13 | Google Places API | Text search for licensed tradespeople | GOOGLE_MAPS_API_KEY (exists) | 10–25/run |
| S14 | Nursys Nursing License | Firecrawl scrape of public lookup, extract with Haiku | FIRECRAWL_API_KEY (exists) | 5–15/run |
| S15 | PHCC Find a Contractor | Firecrawl scrape by Metro Detroit zip codes | FIRECRAWL_API_KEY (exists) | 5–15/run |
| S16 | JATC Graduation Announcements | Firecrawl scrape of 4 JATC sites (detroiteitc.org, aaejatc.org, wmejatc.org, ua190.org) | FIRECRAWL_API_KEY (exists) | 2–8/run |
| S17 | Thumbtack Contractor Profiles | Firecrawl scrape of Thumbtack Detroit trade pages | FIRECRAWL_API_KEY (exists) | 5–15/run |

## Technical Details

### File: `supabase/functions/miosha-license-scraper/index.ts`

**Module scope** (top of file):
- Add `const YELP_API_KEY = Deno.env.get("YELP_API_KEY") || "";`
- `GOOGLE_MAPS_API_KEY` is already available via existing secrets

**8 new async functions**, each returning `Promise<LicenseCandidate[]>`:

1. **`scanVALNewLicenses(sb)`** — Reads `last_val_id` from `agent_heartbeats` where `agent_name = 'miosha-scraper'`. Enumerates next 200 IDs via fetch to VAL HTML pages. Regex extracts name/license_type/city/expiry. Writes back updated `last_val_id`. Baseline start: 1928000.

2. **`scanCraigslistRSS()`** — Fetches RSS XML from `detroit.craigslist.org/search/sks?format=rss` and `trd?query=available&format=rss`. Parses XML for `<item>` elements. Extracts trade keywords from title/description. Applies `isPersonName()`.

3. **`scanYelp()`** — Loops through 4 trade search terms × 6 cities. Calls Yelp Fusion `businesses/search`. Extracts person-like names from business names. Stores phone in raw_data.

4. **`scanGooglePlaces()`** — 4 trade search queries. Calls Places Text Search API. Same owner-operator name extraction pattern as Yelp.

5. **`scanNursys()`** — Uses Firecrawl to scrape Nursys public lookup for MI RN/LPN. Falls back gracefully if blocked. Extracts names via `extractNamesFromMarkdown()`.

6. **`scanPHCC()`** — Firecrawl scrapes PHCC "Find a Contractor" for ~5 Metro Detroit zip codes. Extracts master plumber/HVAC contractor names.

7. **`scanJATCGraduations()`** — Firecrawl scrapes news/events pages from 4 JATC websites. Extracts newly graduated journeymen names via Haiku.

8. **`scanThumbtack()`** — Firecrawl scrapes Thumbtack category pages for Detroit HVAC/plumbing/electrical/boiler. Extracts contractor names, license numbers if visible.

**Promise.allSettled() block** (line 821):
- Add all 8 new functions to the array
- Update `sourceLabels` array to include: `"VAL", "CL-RSS", "Yelp", "GPlaces", "Nursys", "PHCC", "JATC", "Thumbtack"`

**Header comment**: Update source count from 9 to 17.

### Patterns Followed
- Every function has its own try/catch — one failure never blocks others
- Every candidate passes through `isPersonName()` validation
- Every insert includes both `name` and `full_name`
- Each source tagged with unique `source` value but stored as `"miosha"` per existing LicenseCandidate interface
- Console logging: `[S10:VAL] Found 12 candidates`
- AbortSignal.timeout on all external fetches
- Graceful skip if API key missing (Yelp, Firecrawl sources)

### Files Changed
1. `supabase/functions/miosha-license-scraper/index.ts` — add 8 scan functions + wire into Promise.allSettled

### No Changes To
- Database schema (no migration needed)
- Frontend
- Other edge functions
- `supabase/config.toml`

