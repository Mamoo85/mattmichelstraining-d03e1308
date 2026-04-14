

# TechAlert Full Click Test + DJ Conley Demo PDF Generator

## Summary
Two deliverables: (1) a thorough end-to-end click test of all TechAlert/HireAlert flows, and (2) a new `generate-demo-report` edge function + admin PDF button that produces a premium intelligence briefing for DJ Conley.

## Part 1: Full Click Test

Manual verification of every TechAlert/HireAlert touchpoint:

- `/hire-alert` — product landing page loads, Stripe checkout button works
- `/my-techalert` — client dashboard loads via `get-my-techalert` edge function, candidates render with availability labels (not numeric scores), no source names visible, completeness filter active
- Admin `/dwa-admin` → TechAlert tab — clients load, "Run Scanner" button invokes `hire-alert-scanner`, scanner runs table populates, candidates table shows with cross-ref badges and data completeness bars
- Edge function health checks: `hire-alert-scanner`, `get-my-techalert`, `miosha-license-scraper` — verify deployment status and logs
- Source protection: confirm no `source` field leaks to client views anywhere

## Part 2: Generate Demo Report

### New file: `supabase/functions/generate-demo-report/index.ts`
- Queries `hire_alert_candidates` ordered by `availability_score` desc, `first_seen_at` desc, limit 60
- Filters to candidates with valid 2+ word names and at least one of: license_number, city, license_type
- Takes top 20 qualified candidates
- Maps each candidate's `source` to a client-safe signal label via `SOURCE_TO_SIGNAL` map (e.g., `jatc_graduation` → "New to Market", `thumbtack` → "Actively Seeking Work")
- Returns JSON with: `report_date`, `summary` (total, hot, with_license, with_contact, local, trades breakdown), `candidates` array
- No source names, no AI/algorithm/scraper/API language anywhere

### Edit: `supabase/config.toml`
- Add `[functions.generate-demo-report]` with `verify_jwt = false`

### Edit: `src/components/admin/AdminHireAlertClients.tsx`
- Add `generatingPDF` state + `generateDemoPDF()` function
- Add teal "📄 Generate Demo PDF" button in the header button row
- `openPDFWindow()` opens new tab, writes full HTML document
- `buildPDFHTML()` renders the premium intelligence briefing:
  - **Cover page**: DWA dark navy (#0a1628) with teal accents (#00d4ff), "Staffing Intelligence Report", "Prepared for: DJ Conley", KPI grid (total candidates, high priority, with contact info, metro detroit), trade breakdown bar chart
  - **Candidate cards**: Color-coded border (green=high priority, amber=available, slate=monitor), name, license type, license number with "Verify at michigan.gov/lara", city, "WHY NOW" signal box, contact info, employer, experience
  - **Closing page**: Dark navy pitch page — "This Is Not A Staffing Agency" copy, ROI math ($10k agency placement vs $1,788/year TechAlert), CTA with $149/mo pricing, Matt's contact info
  - Missing fields silently omitted (no N/A, no empty rows)
  - Auto-triggers `window.print()` after 900ms

### Rules enforced
1. Source names (pdl, sonar, apollo, npi, craigslist) never appear in PDF
2. Words "AI", "algorithm", "scraper", "API" never appear
3. License numbers always show "Verify at michigan.gov/lara"
4. Missing fields silently omitted
5. PDF opens in new tab with auto print dialog
6. Button: teal background, spinner while loading

## Part 3: YELP_API_KEY Secret
- `YELP_API_KEY` is referenced in `miosha-license-scraper` but not configured in secrets
- Will prompt to add it so the Yelp source activates on next scanner run

## Files Changed
1. `supabase/functions/generate-demo-report/index.ts` — new edge function
2. `supabase/config.toml` — add verify_jwt block
3. `src/components/admin/AdminHireAlertClients.tsx` — add PDF button + generator functions

## Files NOT Changed
- `MyTechAlert.tsx`, `miosha-license-scraper`, database schema — no modifications

