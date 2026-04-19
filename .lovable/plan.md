

## What I verified

**Real DB state (Talent Radar):**
- 167 candidates total. 35 flagged `is_company_name=true`, 69 visible (≥40 completeness), 53 with phone, 21 with email
- Recent inserts are mostly score=2, no city, no phone, no email — Indeed/ZipRecruiter scrapes that never enriched (Dan Wood, Bruce Tate, Ben Marx, etc.)
- Some old rows are still wrong: "Plumb Pros", "Drewski Handyman", "A1 Bargain", "Detroit Metro" — companies, not people. The `is_company_name` filter caught some but not at scrape time

**What's actually broken (proven via logs):**
1. **firecrawl_api = 500** in service-health-monitor (`firecrawl_api=❌(500)`) — confirms the SMS the user sent. Firecrawl key is rejected/expired
2. **contractor-prospector = CPU Time exceeded** — that's the dead-lead "Find Prospects" button failing + "Edge Function returned non-2xx" toast
3. **Demand Radar dashboard "No dashboard token provided"** — user opened `/my-industry-pulse` without `?token=...`. Token exists (`5f420e0ca464fe5fe9c3bb9b17bc386a439d7a99f1652400`) but there's no demo-link button in admin
4. **Talent Radar admin shows last 20 rows only**, no search, no delete, no manual enrich. Only edge function exists for bulk enrichment, no per-candidate UI

**Why the prospector for web design "works so good" but Talent Radar doesn't:**
- contractor-prospector hits Google Places + Firecrawl on KNOWN business URLs → high success
- hire-alert-scanner pulls names from Indeed scrape / MIOSHA list with no website to scrape → enrichment waterfall has nothing to anchor on
- There is NO admin-triggered "enrich this one candidate" button — only the bulk cron

---

## Plan — Build the Talent Radar Candidate Workbench

### 1. New "Candidates" tab in `AdminHireAlertClients.tsx`
Full management table with:
- **Search** by name, license type, city, source
- **Filters**: All / Has phone / Has email / No contact / Companies-flagged / Score ≥ 7
- **Per-row actions**:
  - 🔍 **Enrich** button → calls existing `candidate-deep-enrich` edge function with that single `candidate_id`, polls, refreshes row
  - ⚡ **Quick PDL** → calls a new lightweight `enrich-candidate-manual` function that runs PDL + Hunter + Sonar in series and writes back phone/email/employer/title/linkedin
  - 🗑️ **Delete** with confirm
  - 🏢 **Mark as Company** (sets `is_company_name=true`, hides from clients)
  - 👁 **View** modal — full candidate JSON, source, all enrichment fields, raw data
- Pagination (50/page) instead of "last 20"

### 2. New edge function `enrich-candidate-manual`
- Input: `{ candidate_id }`
- Reads candidate row → runs PDL person enrich → if no hit, runs Hunter domain → if no hit, runs Sonar OSINT → writes results to row
- Returns: `{ ok, hits: { pdl, hunter, sonar }, fields_added: [...] }`
- Modeled on the `test-pdl-premium` pattern that already works

### 3. Demo button for client view
In `AdminHireAlertClients.tsx`, add button **"📺 View as Client (Demo)"** that opens `/talent-radar/dashboard?token={demo_client.dashboard_token}` in new tab. Same pattern for Demand Radar — add **"📺 View Demand Radar Dashboard"** button in `AdminIndustryPulse` linking to `/my-industry-pulse?token=5f420e0ca464fe5fe9c3bb9b17bc386a439d7a99f1652400`. Solves "I can't demo what the client sees."

### 4. Fix the "non-2xx" Find Prospects button
- contractor-prospector exceeded CPU. Wrap the heavy phase in `Promise.race(..., 50s timeout)` and return partial results with `{ok:true, found, emailed, note:"timed out, partial run"}` instead of crashing. UI shows the partial result instead of red toast.

### 5. Acknowledge Firecrawl 500 (NOT fixing here)
Firecrawl API key is returning 500 — that's why service health is RED. **Action:** I'll add a clear warning in admin Service Health card saying "Firecrawl returned 500 — check API key in Lovable Cloud secrets" with a link. I cannot rotate the secret for you. You'll need to verify `FIRECRAWL_API_KEY` is valid in the Lovable Cloud secrets panel.

### 6. Hardening at scrape time (silent killer)
Update `hire-alert-scanner` Indeed/ZipRecruiter parser: skip any "name" that contains words from a junk list (Detroit, Metro, Pros, Bargain, Drain, Handyman, LLC, Inc, Co, Plumbing, Heating, Electric) — those are companies, not people. Backfill: bulk-flag the 35 existing junk rows as `is_company_name=true`.

---

## Files I'll touch

- `src/components/admin/AdminHireAlertClients.tsx` — new Candidates tab with search/filter/actions
- `src/components/admin/CandidateWorkbench.tsx` (new) — table + modal
- `src/components/admin/CandidateDetailModal.tsx` (new) — full enrichment view
- `supabase/functions/enrich-candidate-manual/index.ts` (new) — single-row enrichment
- `supabase/functions/contractor-prospector/index.ts` — add timeout wrap
- `supabase/functions/hire-alert-scanner/index.ts` — junk-name guard at scrape time
- `supabase/migrations/[ts]_backfill_junk_company_names.sql` — flag historical junk
- `src/components/dwa-admin/AdminIndustryPulse.tsx` — demo dashboard button (find file)
- `src/components/admin/ServiceHealth*.tsx` — Firecrawl warning (find file)

## What you get
1. Click any candidate → see full data → click Enrich → get phone/email/employer in 5–15s
2. Delete junk in one click; flag companies as companies
3. Search 167 candidates instantly, see who's actually contactable
4. One-click "View as client" so you can demo Demand Radar and Talent Radar dashboards without hunting tokens
5. Find Prospects button stops red-toasting

## What you must do
- Verify `FIRECRAWL_API_KEY` in Lovable Cloud secrets — currently returning HTTP 500. I cannot fix that from code.

