
# Enterprise Healthcare OSINT Pipeline v4.0 — IN PROGRESS

## What's Deployed

### Phase 1: `test-data-pipeline` Edge Function ✅
**File:** `supabase/functions/test-data-pipeline/index.ts`
- **Modular routing**: Accepts `industry_type` parameter (`"healthcare"` | `"industrial_trades"`)
- Healthcare route: NPI → Nursys (stub) → Sonar Deep Dork → PDL (stub) → No Ghost Lead
- Industrial route: Michigan LARA/MIOSHA (stub) → Sonar Deep Dork → PDL (stub) → No Ghost Lead
- Normalized `GovDataResult` interface — both NPI and LARA return same shape
- Each API has its own `AbortSignal.timeout()` (NPI: 10s, Nursys: 10s, Sonar: 15s, PDL: 10s)
- Hardcoded test candidates:
  - Healthcare: "Sarah Johnson, RN, Detroit MI"
  - Industrial: "Mike Thompson, High-Pressure Boiler Operator, Dearborn MI"
- **NEVER on any cron job** — manual invoke only

### Phase 5: Medicare Client Intel ✅
**Files:**
- `supabase/functions/medicare-staffing-intel/index.ts` — CMS Medicare Care Compare API
- `src/components/admin/AdminMedicareIntel.tsx` — Admin UI
- `src/pages/DWAAdmin.tsx` — "🏥 Client Intel" tab

### Industrial Growth Intel ✅
**Files:**
- `supabase/functions/industrial-growth-intel/index.ts` — Sonar-powered Metro Detroit manufacturing scanner
- `src/components/admin/AdminIndustrialIntel.tsx` — Admin UI
- `src/pages/DWAAdmin.tsx` — "🏭 Industrial Intel" tab

Scans for manufacturing expansions, equipment acquisitions, contract awards, and workforce expansion signals in Metro Detroit. Each lead gets a "TechAlert Pitch" button for instant outreach.

## Architecture: Modular Routing

```text
REQUEST: { industry_type: "healthcare" | "industrial_trades" }
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   HEALTHCARE              INDUSTRIAL
   ├─ NPI API (free)       ├─ Michigan LARA GIS (stub)
   ├─ Nursys (stub)        └─ MIOSHA Boiler Records (stub)
   │                            │
   └────────────┬───────────────┘
                ▼
         UNIVERSAL ENGINE
         ├─ Sonar Deep Dork (same prompt, different name/title)
         ├─ PDL Skip-Trace (same call)
         ├─ No Ghost Lead Filter
         └─ Same Email Action Buttons
```

## API Key Status
- ✅ `OPENROUTER_API_KEY` — set (Sonar Deep Dork)
- ✅ `LOVABLE_API_KEY` — set (AI synthesis)
- ✅ `PDL_API_KEY` — set (People Data Labs)
- ⏳ `NURSYS_API_KEY` + `NURSYS_BASE_URL` — **NOT SET** (Matt will add when available). Code stubs gracefully.
- ✅ NPI API — free, no key needed
- ✅ CMS Medicare API — free, no key needed
- ✅ Michigan LARA GIS — free, no key needed (stub pending integration)

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

### Industrial LARA Integration (when GIS API endpoints confirmed)
- Replace `queryMichiganLARA()` stub with real DTMB GIS Open Data API calls
- Add MIOSHA Boiler Division public records query
- Wire into `hire-alert-scanner` as industrial trade source

## Enrichment Waterfall (per candidate)
```text
1. Government DB (NPI or LARA) — ~1-2s, free
2. Nursys e-Notify (healthcare only, async POST/GET) — ~3-5s (when key available)
3. Sonar Deep Dork (boolean operators) — ~5-8s
4. PDL skip-trace (if LinkedIn found) — ~2-3s
5. AI Synthesis (Lovable Gateway, free) — ~3-5s
Total: ~15-23s/candidate. Top 5 cap = 115s worst case.
```

## Cost
- NPI: Free
- Medicare: Free
- Michigan LARA/MIOSHA: Free
- Industrial Growth Intel: ~$0.003/scan (Sonar)
- Sonar: ~$0.003/candidate
- PDL: ~$0.10/enrichment (only when active)
- Nursys: TBD (institutional subscription)
