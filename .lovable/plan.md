

## What the user is asking

Three things:
1. **Show exactly what a $399 sheet looks like** — a real sample, including how many candidates per sheet
2. **Show exactly what a $2,500/mo MSP tier delivers** — sample
3. **Inventory check**: do we have enough licensees in the DB to actually sell these without running out?
4. **Should we implement Gemini's recommendations now?** (FCRA disclaimers, dual pricing, MSA gate, etc.)

This is part research/preview, part implementation decision. Mostly research deliverable + a clear "what to implement now vs later" recommendation.

## Approach

### Step 1: Read-only inventory check (do this now in plan mode)
- Query `hire_alert_candidates` to get actual current count by role/score/state
- Query `hire_alert_clients` to see how many are active (affects exclusivity math)
- Check the scanner run history (`hire_alert_runs`) — daily new-candidate volume
- This determines whether $399/10-name sheets and $2500/mo monthly feeds are actually fulfillable

### Step 2: Generate two real sample PDFs from live data
- **$399 Pay-Per-Sheet**: 10 candidates, redacted last names + last-4 phone (per Gemini's "blind sample" advice), full role/city/score/license-issued date, no source attribution
- **$2,500/mo MSP Tier**: 50 candidates over 30 days, full contact info (mobile + email), AI-generated qualification summary per candidate, exclusivity territory map, weekly digest preview
- Save both to `/mnt/documents/` as downloadable PDFs

### Step 3: Inventory math
Calculate based on real data:
- Total licensed candidates in pool
- Daily new-license intake rate (from scanner runs)
- Burn rate at $399 tier (10/sheet × N sheets/mo) and $2500 tier (~50/mo per agency, exclusive territory)
- Verdict: how many concurrent clients per vertical/territory before we run out

### Step 4: Gemini implementation recommendations
Don't implement everything now. Plan it as:

**Implement NOW (low-risk, high-value):**
- Add the 3 ToS clauses (FCRA disclaimer, Derived Data, TCPA shield) to `/legal/terms` 
- Add an MSP/white-label inquiry checkbox/route to `/hire-alert` landing page (Opus's idea, Gemini agreed)
- Add the "B2B Market Intelligence Feed — not a Consumer Report" disclaimer to checkout pages

**Defer until lawyer review (1-2 weeks):**
- Dual pricing structure ($399 sheet + $2500 monthly) — wait for lawyer's answer on whether one-time bypasses CRA threshold
- MSA-gated subscription tier — needs lawyer-drafted document
- Talent Radar → License Pulse rename — minor branding, can wait

**Do NOT implement:**
- MSP white-label tier (Risk Score: Extreme per memo) — defer 6+ months
- Direct-to-candidate SMS/email (TCPA landmine confirmed)
- Removing source attribution from internal admin views (only sanitize client-facing — admins need the truth)

### Out of Scope
- No pricing changes to existing `create-hire-alert-checkout` until lawyer signoff
- No new product pages
- No rename
- No actual MSP outreach
- Lab products / fitness app untouched

## Files Touched (Phase implementation portion)

1. `src/pages/legal/Terms.tsx` (or wherever `/legal/terms` lives) — add 3 new sections (FCRA, Derived Data, TCPA Shield)
2. `src/pages/HireAlert.tsx` — add MSP/white-label inquiry CTA + "B2B Market Intelligence" disclaimer line
3. `supabase/functions/create-hire-alert-checkout/index.ts` — add `tos_version: "2026-04-fcra"` to metadata so we can prove which version they accepted
4. `supabase/functions/create-hire-alert-one-time/index.ts` — same metadata stamp
5. New edge function `msp-inquiry-submit` — captures MSP interest without auto-charging (manual sales call)
6. New page `src/pages/HireAlertMSPInquiry.tsx` — gated form, not a checkout

## Deliverables (research portion)

1. **Live inventory report** delivered in chat (counts, daily intake, burn-rate math)
2. **Sample $399 sheet PDF** — `/mnt/documents/sample-techalert-sheet-399.pdf`
3. **Sample $2,500/mo monthly delivery PDF** — `/mnt/documents/sample-techalert-monthly-2500.pdf`
4. **Implementation verdict** — explicit list of what to ship now vs defer

