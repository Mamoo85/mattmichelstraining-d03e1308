

# TechAlert Data Quality & Source Protection Overhaul

## Summary
Five fixes to protect proprietary intelligence methods from clients, eliminate AI hallucinations, add cross-reference confidence signals, enforce data completeness minimums, and store PDL LinkedIn URLs properly.

## Technical Details

### Migration
**New file**: `supabase/migrations/20260414200000_candidate_quality_columns.sql`
- Add `cross_referenced boolean DEFAULT false` to `hire_alert_candidates`
- Add `data_completeness integer DEFAULT 0` to `hire_alert_candidates`

### FIX 1: Source Protection — Client Views

**`src/pages/MyTechAlert.tsx`** (~15 changes):
- Remove `source` from interface and all references (line 45, 524)
- Replace numeric score badges (lines 545-554) with availability labels: `🟢 High Availability` (8-10), `🟡 Possible Availability` (5-7), `🔵 Monitor` (1-4)
- Remove score numbers from profile photo overlay and fallback badge
- Replace "Hot (7+)" filter label with "🟢 High Availability"
- Replace "Available (5-6)" filter with "🟡 Possible"
- Replace `isLapsed` check (was `c.source === "license_expiry"`) with license_expiry date check
- Add license status label: `Active` / `Expiring Soon` / `Recently Lapsed` based on `license_expiry` date
- Change "Alerted:" timestamp to "Identified X days ago" using `alerted_at`
- Filter candidates to only show `data_completeness >= 40` (need to add this field from the API)
- Sort cross-referenced candidates first

**`supabase/functions/get-my-techalert/index.ts`**:
- Add `cross_referenced` and `data_completeness` to the candidate select
- Stop returning `source` field entirely (currently returns it for license_expiry badge — replace with license_expiry date logic)
- Replace numeric `availability_score` with an `availability_label` string
- Filter out candidates with `data_completeness < 40`

**`supabase/functions/hire-alert-scanner/index.ts`** (email/SMS templates):
- Line 728: Replace `${c.availability_score}/10` with availability label (🟢/🟡/🔵)
- Line 817: Change "Our hiring intelligence engine scanned the market" → "We identified new licensed professionals near you"
- Line 834: Remove "appeared in hiring channels" phrasing
- Lines 826-840: Replace "How Scoring Works" section with plain availability tier descriptions (no methodology hints)
- SMS body (lines 1215-1217): Remove raw score number, use availability label instead

### FIX 2: Hallucination Guards (Sonar only)

**`supabase/functions/miosha-license-scraper/index.ts`**:
- The `isPersonName()` function (line 47) and `looksLikeLicenseNumber()` (line 57) already exist and cover most validation
- Add additional guards in Sonar result processing: city validation (reject "Michigan"/"MI" as city), require valid license_number OR real city
- Add company keyword list expansion per the prompt (School, Hospital, University, District already present at line 42-44)
- These guards apply ONLY to Sonar/AI-sourced candidates, not NPI/PDL/government sources

### FIX 3: Cross-Reference Logic

**`supabase/functions/miosha-license-scraper/index.ts`** — in `upsertCandidate()` (line 709):
- After insert, query for existing row matching `full_name + city + license_type` from different `source`
- If found: set `cross_referenced = true` on both rows, add +2 to `availability_score`

**`src/components/admin/AdminHireAlertClients.tsx`**:
- Add `⚡ Cross-Referenced` badge on candidate rows

**`src/pages/MyTechAlert.tsx`**:
- Sort cross-referenced candidates first in the feed

### FIX 4: Data Completeness Score

**`supabase/functions/miosha-license-scraper/index.ts`** — in `upsertCandidate()`:
- Calculate: +20 (full_name) +20 (valid city) +20 (license_type) +20 (license_number) +10 (license_expiry) +10 (linkedin_url in raw_data)
- Store as `data_completeness` on insert/update

**`src/components/admin/AdminHireAlertClients.tsx`**:
- Add small completeness progress bar on each candidate row

**`src/pages/MyTechAlert.tsx`** / **`get-my-techalert`**:
- Only show candidates where `data_completeness >= 40`

### FIX 5: PDL LinkedIn URL Storage

**`supabase/functions/miosha-license-scraper/index.ts`** — in `scanPDL()`:
- Ensure `linkedin_url` from PDL response is stored in `raw_data` object
- In `MyTechAlert.tsx`: render as "View Profile →" link (already partially done — just ensure no source attribution)

## Files Changed
1. `supabase/migrations/20260414200000_candidate_quality_columns.sql` — new columns
2. `supabase/functions/miosha-license-scraper/index.ts` — hallucination guards, cross-ref logic, data completeness calc, PDL linkedin storage
3. `supabase/functions/hire-alert-scanner/index.ts` — sanitize email/SMS templates (remove source refs, replace scores with labels)
4. `supabase/functions/get-my-techalert/index.ts` — filter by completeness, replace scores with labels, remove source field
5. `src/pages/MyTechAlert.tsx` — remove source display, replace numeric scores with color labels, filter completeness >= 40, sort cross-referenced first
6. `src/components/admin/AdminHireAlertClients.tsx` — add completeness bar + cross-referenced badge (admin keeps full visibility)

## What Does NOT Change
- Scoring logic internals, dedup logic, 8-source parallel architecture
- NPI/PDL enrichment flows
- Admin panel full source visibility
- Existing `hire_alert_candidates` columns

