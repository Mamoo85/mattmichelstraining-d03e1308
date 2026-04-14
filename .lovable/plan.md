

# Fix TechAlert: Restore Direct LARA Database Access as Primary Source

## The Core Problem

TechAlert's entire value proposition is: "We monitor state licensing databases so you know about new tradespeople before anyone else." But right now, **neither data source actually queries LARA directly.** Both use Sonar AI web search to *hope* it finds licensing data. That's why results are garbage — company names, no license numbers, no real records.

The `scanBPL()` function (which downloads actual LARA Excel files) and `scanFloridaDBPR()` were documented as built in Phase 10 but are **missing from the current codebase**. They need to be rebuilt.

## Architecture: Database First, Social Second

```text
LAYER 1 — PRIMARY (the product's core value)
┌──────────────────────────────────────────────┐
│  Michigan LARA BPL Portal (direct download)  │
│  → Excel/CSV files with REAL names,          │
│    license numbers, issue dates, cities      │
│  → aca-prod.accela.com/LARA portal search    │
└──────────────────────────────────────────────┘
           ↓ Real people with verified licenses
           
LAYER 2 — ENRICHMENT (enhancement only)
┌──────────────────────────────────────────────┐
│  Sonar OSINT → LinkedIn, Facebook, Indeed    │
│  NPI Registry → Healthcare credentials       │
│  PDL → Phone, personal email                 │
└──────────────────────────────────────────────┘
           ↓ Contact info + social profiles
           
LAYER 3 — SUPPLEMENTARY (bonus leads)
┌──────────────────────────────────────────────┐
│  Job board search (Indeed/ZipRecruiter)       │
│  → People actively seeking work              │
│  → Lower priority, no license verification   │
└──────────────────────────────────────────────┘
```

## The Fix (4 Parts)

### Part 1: Rebuild `scanBPL()` — Direct LARA Excel Downloads
- Michigan LARA Bureau of Professional Licensing publishes downloadable Excel/CSV lists at their BPL portal
- Use SheetJS (xlsx library) to parse the spreadsheets server-side
- Extract: full name, license number, license type, issue date, expiry date, city/state
- Target categories: Boiler, Electrical, Plumbing, HVAC/Mechanical, Nursing (CNA/LPN/RN)
- Filter for recently issued/renewed licenses (last 90 days)
- This gives us **real names with real license numbers** — the foundation of the product

### Part 2: Upgrade `miosha-license-scraper` Prompts
- Current prompts ask Sonar to "search Michigan LARA licensing database" — too vague
- Rewrite to specifically target the LARA Accela portal (aca-prod.accela.com/LARA) records
- Add explicit instruction: "Return ONLY individual person names with their Michigan state license numbers. NEVER return employer names, school names, or organization names."
- Reduce results per query from 20 to 8 for higher quality

### Part 3: Enforce Source Priority in Scanner
- Rename the scan flow to make the hierarchy explicit:
  1. `scanBPL()` runs FIRST — direct LARA data (highest trust)
  2. `scanMIOSHA()` runs second — Sonar search of LARA records (medium trust)
  3. `scanJobBoards()` runs last — supplementary leads (lowest trust)
- Scoring: BPL-sourced candidates get +3 bonus (verified license from state DB)
- MIOSHA-sourced get +1 if they have a license number
- Job board candidates get no bonus and -2 if no license found

### Part 4: Enrichment Stays Secondary
- LinkedIn/Facebook/Indeed profile lookups remain in the Sonar OSINT enrichment layer
- They run AFTER we have a verified name + license from LARA
- This is the correct order: state database → identity → contact info → social profiles

## Files Changed
- `supabase/functions/hire-alert-scanner/index.ts` — add `scanBPL()`, reorder sources, update scoring
- `supabase/functions/miosha-license-scraper/index.ts` — upgrade prompts for accuracy
- Both functions redeployed and tested

## Why This Matters
Without direct LARA access, TechAlert is just another AI-powered job board scraper — exactly what competitors do. The LARA database is the moat. Real license numbers from a state government database cannot be replicated by Indeed or LinkedIn. That's what makes this product worth $99/mo.

