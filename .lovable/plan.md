

## Audit Results — what's actually broken

I called all 4 functions live and inspected the response shapes. Here's the truth:

### 1. Medicare — Backend WORKS, frontend doesn't render
Live API call returned **dozens of 1- and 2-star facilities** (Beaconshire, Orchards at Harper Woods, Roseville, Warren, etc.) with full data. The component sets `facilities` state correctly, but the screenshot shows the empty state. Most likely cause: a stale browser bundle, OR the toast fires `Found X` but the table render path has a bug. Need to verify by reading the rendering code carefully and confirming `facilities.length > 0` actually renders the table. This is the easy fix.

### 2. ThomasNet pull — Apify returns HTTP 403
Live call returned `502 - Actor run failed status: 403`. The actor `zen-studio~thomasnet-suppliers-scraper` is either:
- A paid actor your Apify account hasn't rented, OR
- A misnamed/private actor

Real fix: swap to a **free public actor** (e.g. `apify/web-scraper` or `compass/crawler-google-places`) OR rebuild ThomasNet pull to scrape directly via Firecrawl (we have `FIRECRAWL_API_KEY`).

### 3. Boiler Sector Intel — returns 0 because data sources are empty
Three scans run in parallel:
- **Compliance gap** — queries `hire_alert_candidates` filtered by boiler-license-type AND `current_employer` matching hospital/school/etc. The candidates table likely has no rows matching those exact license-type strings → 0 results.
- **Bond funding** — Sonar AI search via Lovable AI gateway. `google/gemini-2.5-flash` is NOT a Sonar/web-search model, it's an LLM with no web access → it returns `[]` or hallucinated empty.
- **Expansion hiring** — same Sonar problem.

Real fix: route the two web-research scans through **OpenRouter Perplexity Sonar** (`perplexity/sonar-pro`) — we already use this elsewhere (techalert-prospect-hunter) and `OPENROUTER_API_KEY` is configured.

### 4. Accela — auth fails for all 11 agencies
Live test confirmed: every one of the 11 agencies returned `auth_failed / no_token`. Credentials exist in secrets. Likely root cause: **Accela `agency_name` parameter format is wrong** — Accela expects the agency's actual short ID as registered in their developer console (e.g. `DETROIT`, not `DETROIT_MI`), AND your app must be individually approved per agency. Most public Accela apps only get auto-approval for sandbox `ISSSTAGING`.

Real fix: there are two paths:
1. **Code fix**: try a different agency-name pattern (drop `_MI` suffix), AND fall back to Accela's public-records search API which doesn't need agency-level OAuth.
2. **Honest UX fix**: the Accela API is gated by per-agency approval that takes weeks. Replace this scanner's primary path with the **Detroit BSEED ArcGIS feed** (free, no auth, already documented in your memory) and demote Accela to a secondary/optional source.

---

## The plan (what I'll do once you approve)

### Phase 1 — Medicare visibility (highest confidence fix)
- Re-read `AdminMedicareIntel.tsx` render logic line-by-line to confirm the bug
- Add an explicit "loaded N from API" debug line under the scan button
- Add a **clickable row action panel** (not just modal) — Call / Email / Google / View on Medicare.gov / Add to TechAlert prospects DB / Add to postcard queue
- Wire **"Add to TechAlert prospects"** button → inserts into `techalert_prospect_targets` so they flow into your existing prospect hunter UI

### Phase 2 — Boiler Intel (real data, not empty)
- Swap `aiChat()` and `sonarSearch()` to OpenRouter `perplexity/sonar-pro` (real web search) — same pattern as `techalert-prospect-hunter`
- Loosen the compliance-gap query: also pull from `miosha_licenses` table directly if it exists, not just `hire_alert_candidates`
- Add diagnostic counters in the response so the toast shows *why* a scan returned 0 (e.g. "Sonar returned 4 raw, 0 passed confidence ≥6 filter")

### Phase 3 — ThomasNet (replace broken Apify actor)
- Rewrite `apify-thomasnet-pull` to use **Firecrawl** against ThomasNet category pages (`thomasnet.com/suppliers/michigan/boiler-manufacturers/...`) — we already pay for Firecrawl
- Parse company name + city + url from the markdown, upsert as before
- Same UI, same results table, just a working data source

### Phase 4 — Accela (honest fallback)
- Add a real fallback inside `accela-permit-scanner`: when all agencies return `auth_failed`, hit the **Detroit BSEED ArcGIS REST API** (free, public — already used by `industry-pulse-scanner`) for last 7 days of trades permits and write those into `industry_pulse_signals` so the scan still produces useful results
- Update the WaterfallDiagnostics row for Accela to show "Accela auth gated — using BSEED ArcGIS fallback (N permits)" instead of looking like a hard failure
- Add a one-line explainer in `WaterfallDiagnostics` linking to developer.accela.com so you know the long-term path is "request agency approval"

### Phase 5 — Universal "make every result clickable"
For Medicare, Boiler signals, Industrial Growth, and ThomasNet rows — add the same 5-action toolbar to each row:
- 📞 Call (tel:)
- ✉️ Email (mailto with pre-filled pitch)
- 🔎 Google
- 📋 Copy contact info
- ➕ Add to TechAlert prospects (writes to `techalert_prospect_targets`)

That last button is the key piece you've been asking for — every market-intel result becomes a one-click prospect that flows into your existing outreach pipeline.

### Files I'll touch
- `supabase/functions/medicare-staffing-intel/index.ts` — already correct, no change unless render audit reveals shape mismatch
- `supabase/functions/boiler-sector-intel/index.ts` — switch to OpenRouter Sonar, add diagnostics
- `supabase/functions/apify-thomasnet-pull/index.ts` — full rewrite to Firecrawl
- `supabase/functions/accela-permit-scanner/index.ts` — add BSEED ArcGIS fallback
- `src/components/admin/AdminMedicareIntel.tsx` — add per-row action toolbar + Add-to-Prospects
- `src/components/admin/AdminIndustrialIntel.tsx` — same toolbar on signals + leads
- `src/components/dwa-admin/WaterfallDiagnostics.tsx` — better Accela messaging
- One new shared helper: `src/lib/addToTechAlertProspects.ts`

### Risk / what I won't promise
- Accela will still need per-agency approval to ever return real Accela data. The BSEED ArcGIS fallback covers Detroit only — Royal Oak, Warren, etc. are gated until you get approved by each city. I'll make the diagnostics tell you that clearly instead of pretending it works.
- Boiler Sonar results depend on whether real bond/hiring news actually exists in the past 30–90 days. Some scans will legitimately return small numbers — but they'll be real, not hallucinated.

