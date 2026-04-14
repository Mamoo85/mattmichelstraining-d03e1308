

# Add 5 Sources (S11 Yelp Fix + S14–S17) to miosha-license-scraper

## Summary
Add 5 scan functions to `miosha-license-scraper/index.ts` and wire them into the existing `Promise.allSettled()` block. Fix the Yelp source (S12 per header, called S11 by user) now that `YELP_API_KEY` is available. Add PHCC (S15), JATC (S16), Thumbtack (S17), and Nursys (S14). Purely additive.

## What Gets Built

### 1. `scanYelp()` — Yelp Fusion API (Fix)
- `YELP_API_KEY` already at module scope (line 35), already reads from env
- 4 trade search terms × 6 Metro Detroit cities
- `GET https://api.yelp.com/v3/businesses/search` with Bearer auth
- Extract owner-operator names from business names (strip trade words, test with `isPersonName()`)
- Store phone in raw_data-style fields; skip silently if key empty

### 2. `scanPHCC()` — PHCC Contractor Directory
- POST to `phccweb.org/tools-resources/find-a-contractor/` with zip codes
- 20 Metro Detroit zip codes, 10 per run
- Parse HTML for contractor names, strip company suffixes, run `isPersonName()`
- Infer license_type from company keywords

### 3. `scanJATCGraduations()` — JATC News Pages
- Fetch 4 JATC news URLs (detroiteitc.org, aaejatc.org, ualocal98.org, local80.org)
- Regex for graduation keywords, extract capitalized name patterns
- Use `extractNamesFromMarkdown()` via Gemini if raw regex insufficient
- Each site has 10s timeout, independent try/catch

### 4. `scanThumbtack()` — Thumbtack Pro Profiles
- Fetch 5 Thumbtack category pages for Detroit trades
- Parse JSON-LD (`@type: Person/LocalBusiness`) for names
- Fallback: regex for profile name patterns in HTML
- 15s timeout, skip on non-200

### 5. `scanNursys()` — Nursys License Lookup
- GET Nursys public search page for MI RN/LPN
- Parse response table for name, license number, expiry
- 20s timeout, return [] silently if not parseable

## Technical Details

### File: `supabase/functions/miosha-license-scraper/index.ts`

**Insert 5 new functions** between `scanCraigslist()` (ends line 534) and `scanViaSonar()` (line 536). Each function:
- Returns `Promise<LicenseCandidate[]>`
- Has its own try/catch
- Uses `AbortSignal.timeout()` on all fetches
- Passes all candidates through `isPersonName()`
- Logs `[S12:Yelp]`, `[S14:Nursys]`, `[S15:PHCC]`, `[S16:JATC]`, `[S17:Thumbtack]` format

**Update `Promise.allSettled()` block** (line 831):
```
scanYelp(),              // S12
scanNursys(),            // S14
scanPHCC(),              // S15
scanJATCGraduations(),   // S16
scanThumbtack(),         // S17
```

**Update `sourceLabels`** array (line 842) to add: `"Yelp", "Nursys", "PHCC", "JATC", "Thumbtack"`

### No Changes To
- Database schema
- Frontend
- Other edge functions
- `supabase/config.toml`

