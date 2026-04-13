

# Multi-Industry Modular Pipeline Expansion

## What We're Doing

Making the `test-data-pipeline` and overall architecture **industry-agnostic** by adding an `industry_type` parameter that routes candidates through the correct government database while sharing the same Sonar + PDL enrichment engine.

---

## Changes

### File 1: `supabase/functions/test-data-pipeline/index.ts` — REWRITE

**Add `industry_type` parameter** (accepts `"healthcare"` or `"industrial_trades"` from request body, defaults to `"healthcare"`).

**Add routing logic:**
- `healthcare` → runs NPI + Nursys (existing code, unchanged)
- `industrial_trades` → runs new `queryMichiganLARA()` stub that targets State of Michigan GIS Open Data API for newly licensed Master Plumbers, HVAC Contractors, Electricians, and MIOSHA High-Pressure Boiler Operators

**Add `queryMichiganLARA()` stub:**
- Placeholder function that returns license type, license number, city from Michigan's public dataset
- Structured to later hit the DTMB GIS Open Data portal REST API
- Returns same shape as NPI result (normalized) so downstream Sonar + PDL don't care about the source

**Sonar + PDL stay identical** — the only difference is what `title` and `city` get passed in. A boiler operator and a nurse both flow through `enrichViaSonar()` and `enrichWithPDL()` with zero code changes.

**Add second hardcoded test candidate** for industrial:
```
{ first_name: "Mike", last_name: "Thompson", title: "High-Pressure Boiler Operator", city: "Dearborn", state: "MI" }
```

**Pipeline selection at runtime:**
```
POST body: { "industry_type": "industrial_trades" }
→ skips NPI/Nursys, runs queryMichiganLARA() instead
→ feeds result into same Sonar → PDL → No Ghost Lead chain
```

### File 2: `supabase/functions/industrial-growth-intel/index.ts` — NEW

The industrial equivalent of `medicare-staffing-intel`. Uses Sonar (perplexity/sonar-pro) to search for:
- Recent manufacturing facility expansions in Metro Detroit
- New plant openings or large commercial HVAC contracts awarded
- Companies acquiring CNC/industrial machinery (Addy Machinery targets)

Returns a list of companies with name, location, expansion type, and news source. This is the "who needs to hire tradesmen RIGHT NOW" signal for industrial clients.

### File 3: `src/components/admin/AdminIndustrialIntel.tsx` — NEW

Admin panel component (mirrors `AdminMedicareIntel.tsx` structure):
- Table showing: company name, expansion type, location, news date
- "Send TechAlert Pitch" button per company
- Dark DWA branding

### File 4: `src/pages/DWAAdmin.tsx` — EDIT

Add `"industrial"` tab: `{ id: "industrial", label: "🏭 Industrial Intel" }`
Lazy-load `AdminIndustrialIntel`.

### File 5: `.lovable/plan.md` — UPDATE

Document the modular routing architecture and new industrial data sources.

---

## What Does NOT Change

- `hire-alert-scanner/index.ts` — no changes yet. Production stays untouched until test-data-pipeline validates both routes.
- `candidate-deep-enrich/index.ts` — no changes.
- `medicare-staffing-intel/index.ts` — stays as-is for healthcare clients.
- All existing Sonar, PDL, NPI, Nursys functions — code is reused, not duplicated.

## No New Secrets Required

- Michigan LARA GIS Open Data API is free, no auth
- Industrial Growth Intel uses existing `OPENROUTER_API_KEY`
- Everything else already configured

## Architecture Diagram

```text
REQUEST: { industry_type: "healthcare" | "industrial_trades" }
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   HEALTHCARE              INDUSTRIAL
   ├─ NPI API              ├─ Michigan LARA GIS (stub)
   ├─ Nursys (stub)        └─ MIOSHA Boiler Records
   │                            │
   └────────────┬───────────────┘
                ▼
         UNIVERSAL ENGINE
         ├─ Sonar Deep Dork (same prompt, different name/title)
         ├─ PDL Skip-Trace (same call)
         ├─ No Ghost Lead Filter
         └─ Same Email Action Buttons
```

