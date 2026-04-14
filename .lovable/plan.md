

# Intent-Driven Dashboard Overhaul — Build Plan

## Scope

Redesign MyTechAlert.tsx (TechAlert client dashboard), AgencyClientPortal.tsx (contractor client portal), and create a shared Revenue Recovered Ledger component. All wired to real backend data, DWA dark teal palette, TCPA-compliant draft-only outreach.

---

## Section 1 — TechAlert Dashboard (MyTechAlert.tsx)

### 1A. Market Signals Feed (Top Fold)

Add a new section between the KPI strip and the candidate list that queries `industry_pulse_signals` (confidence >= 7) joined with the client's `target_roles` via industry matching. Fallback: if no signals exist, query `hire_alert_candidates` where score >= 8 and surfaced in last 48h.

Each signal card renders:
- Company name + location
- Signal type badge (Expansion / Hiring / Cross-Referenced with color coding)
- `recommended_pitch` text from `industry_pulse_signals`
- "Draft TechAlert Pitch" button opening the outreach draft modal pre-filled with pitch copy

New edge function needed: **`get-techalert-signals`** — accepts `{ token }`, validates client, queries `industry_pulse_signals` filtered by the client's tracked industries, returns top 10 signals. Falls back to hot candidates if no signals exist.

Empty state: "Scanner running. First signals appear within 24h."

### 1B. Action Buttons (already mostly exist)

The existing Claim and Draft Outreach buttons are already functional. Changes:
- Move Claim button to be visible in the collapsed card header (not just expanded view) for score >= 7 candidates
- Add "Draft TechAlert Pitch" button on signal cards (opens same outreach modal with different context)
- Ensure all buttons have proper loading spinners + disabled states (already implemented)

### 1C. Claim Race Condition Fix

The current `claim-candidate/index.ts` already has the atomic update with `.or('claimed_at.is.null,claim_expires_at.lt.${now}')`. This is functionally correct but uses Supabase JS client syntax. No change needed — the race condition is already handled.

### 1D. Email Auto-Claim Link

Already implemented at lines 103-108 of MyTechAlert.tsx. The `?claim=X&auto=1` params are read on mount and auto-fire `claimCandidate()`. No change needed.

### 1E. License Lapsed Tier

Already implemented. `isLapsed` check on line 412, amber badge on lines 437-441, warning message on lines 468-475. No change needed.

### 1F. Visual Overhaul

Restyle all cards to use `border-white/5 + bg-gradient-to-br from-[#0a1628] to-[#0d1f2e]`. Update accent CTAs to `#00d4ff`. Confidence badges: emerald-500 (>=8), amber-500 (5-7), slate-500 (<5). The current colors are close but need alignment to the spec.

---

## Section 2 — Contractor Client Portal (AgencyClientPortal.tsx)

The contractor portal is at `/agency-portal` → `src/pages/AgencyClientPortal.tsx`. Currently shows tenant_leads with search/pagination. This needs to be enhanced:

### 2A. High-Intent Radar

Query `contractor_leads` where `status = 'available'` and `created_at > now() - 24h`, filtered by the contractor's trade/city. Also query `contractor_lead_views` for this contractor to surface FOMO signals (leads they tried to buy but were already sold).

New edge function needed: **`get-contractor-signals`** — accepts auth token (RLS-based, since this portal uses Supabase auth), returns available leads + missed lead count.

### 2B. Action Buttons

- "Claim Lead" button linking to existing contractor lead purchase flow
- FOMO card for locked leads: "Locked by competitor — upgrade to territory lock for $399/mo" with CTA to `/contractor-leads`
- No direct SMS buttons — leads delivered via existing cron

### 2C. Visual Overhaul

Same DWA dark teal palette. Replace the current inline `style={}` approach with Tailwind classes matching the spec.

---

## Section 3 — Revenue Recovered Ledger

### Existing Component

`src/components/shared/RevenueRecoveredTicker.tsx` already exists with animated counter + `get-client-revenue-stats` edge function integration. Per spec: **no animated counter** — change to static number with sparkline.

### New Component: `RevenueRecoveredLedger.tsx`

Rendered in nav/header area of both dashboards. Uses the existing `get-client-revenue-stats` edge function but with new parameters:
- TechAlert: sum `hire_alert_client_candidates.client_action = 'hired'` x $8,000
- Contractor: sum `dead_lead_charges.amount` for this contractor

New edge function: **`client-revenue-recovered`** — accepts `{ token, client_type }`, returns `{ total_recovered_cents, period: '90d' }`.

Hidden entirely if $0. No animation. Static formatted number. React Query with 5-min staleTime.

---

## Files Changed

| File | Action |
|------|--------|
| `src/pages/MyTechAlert.tsx` | Add Market Signals section, restyle cards to DWA palette |
| `src/pages/AgencyClientPortal.tsx` | Add High-Intent Radar, FOMO cards, restyle to DWA palette |
| `src/components/RevenueRecoveredLedger.tsx` | NEW — static revenue ledger for nav |
| `supabase/functions/get-techalert-signals/index.ts` | NEW — token-gated signal feed |
| `supabase/functions/client-revenue-recovered/index.ts` | NEW — 90-day revenue sum |
| `supabase/config.toml` | Add `verify_jwt = false` for 2 new functions |

## Edge Functions (2 new)

1. **`get-techalert-signals`** — validates dashboard_token, queries industry_pulse_signals by client's industries, falls back to hot candidates. Returns max 10 signals.

2. **`client-revenue-recovered`** — validates token (dashboard_token for TechAlert, roi_token for contractor), sums hired placements x $8,000 for TechAlert clients, sums dead_lead_charges for contractor clients. Returns `{ total_recovered_cents, period }`.

## No New Tables or Migrations

All data sources already exist: `industry_pulse_signals`, `hire_alert_client_candidates`, `contractor_leads`, `contractor_lead_views`, `dead_lead_charges`.

## Build Sequence

1. Wave A: MyTechAlert.tsx + get-techalert-signals (highest impact)
2. Wave B: RevenueRecoveredLedger + client-revenue-recovered (shared infra)
3. Wave C: AgencyClientPortal.tsx redesign (depends on Wave B)

