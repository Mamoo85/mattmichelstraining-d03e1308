
# Enterprise Healthcare OSINT Pipeline v4.0 — IN PROGRESS

## What's Deployed

### Phase 1: `test-data-pipeline` Edge Function ✅
**File:** `supabase/functions/test-data-pipeline/index.ts`
- Full enrichment chain: NPI → Nursys (stub) → Sonar Deep Dork → PDL (stub) → JSON Regex Stripper → No Ghost Lead
- Each API has its own `AbortSignal.timeout()` (NPI: 10s, Nursys: 10s, Sonar: 15s, PDL: 10s)
- NPI + Nursys run in parallel via `Promise.all()`
- Hardcoded test candidate: "Sarah Johnson, RN, Detroit MI"
- Returns full pipeline results + timing breakdown + API status
- **NEVER on any cron job** — manual invoke only

### Phase 5: Medicare Client Intel ✅
**Files:**
- `supabase/functions/medicare-staffing-intel/index.ts` — CMS Medicare Care Compare API
- `src/components/admin/AdminMedicareIntel.tsx` — Admin UI
- `src/pages/DWAAdmin.tsx` — "🏥 Client Intel" tab added

Queries federal CMS API for Metro Detroit nursing homes (zip 480xx-483xx) with 1-2 star staffing ratings. Admin panel shows facility table with staffing/overall ratings, bed count, phone, and "TechAlert Pitch" email button.

## API Key Status
- ✅ `OPENROUTER_API_KEY` — set (Sonar Deep Dork)
- ✅ `LOVABLE_API_KEY` — set (AI synthesis)
- ⏳ `NURSYS_API_KEY` + `NURSYS_BASE_URL` — **NOT SET** (Matt will add when available). Code stubs gracefully.
- ⏳ `PDL_API_KEY` — **NOT SET** (placeholder). Code stubs gracefully.
- ✅ NPI API — free, no key needed
- ✅ CMS Medicare API — free, no key needed

## Remaining Phases

### Phase 2: NPI + Nursys in Production (after test-data-pipeline validates)
- Add `enrichViaNPI()` to `hire-alert-scanner` inline enrichment loop
- Add Nursys lookup for healthcare candidates (when key is ready)
- Upgrade Sonar prompt with boolean `site:` operators

### Phase 3: PDL Integration (when PDL_API_KEY is set)
- Add `enrichWithPDL()` after Sonar in production pipeline
- Mobile phone + personal email append

### Phase 4: Email UI Action Buttons (after Phase 2 validates)
- Redesign candidate cards with conditional action buttons
- Add NPI business phone as separate `📞 Business Line` button
- Add taxonomy badge

### Phase 6: Production Fallback
- Update `candidate-deep-enrich` with NPI + PDL second-pass

## Architecture: Enrichment Waterfall (per candidate)
```text
1. NPI API (healthcare only) — ~1-2s, free
2. Nursys e-Notify (async POST/GET) — ~3-5s (when key available)
3. Sonar Deep Dork (boolean operators) — ~5-8s
4. PDL skip-trace (if LinkedIn found) — ~2-3s (when key available)
5. AI Synthesis (Lovable Gateway, free) — ~3-5s
Total: ~15-23s/candidate. Top 5 cap = 115s worst case.
```

## Cost
- NPI: Free
- Medicare: Free
- Sonar: ~$0.003/candidate
- PDL: ~$0.10/enrichment (only when active)
- Nursys: TBD (institutional subscription)
