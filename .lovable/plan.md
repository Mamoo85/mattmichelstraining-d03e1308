

# Corrected Plan: TechAlert Fix + Visitor Drill-Down + SMS Audit

## What changed from the previous plan

The user's strategic advisor correctly identified three fatal flaws in the original Step C (SMS rewrite):
1. **contractor-lead-notify "Call Now" is correct** — it means call the *homeowner*, not the agency. Speed-to-lead is everything. Do NOT touch this copy.
2. **"Reply RESCHEDULE" is a phantom feature** — no webhook exists to handle that keyword. Don't write copy for features that don't exist.
3. **Admin Outbox audit layer is unnecessary bloat** — fix templates directly, don't build a linter UI.

## Implementation

### A. TechAlert Schema Fix (database)
Migration: `ALTER TABLE hire_alert_clients ADD COLUMN IF NOT EXISTS notify_email boolean DEFAULT true; ALTER TABLE hire_alert_clients ADD COLUMN IF NOT EXISTS notify_sms boolean DEFAULT true;`

The admin form already sends these fields — the table just needs the columns.

### B. Visitor Intelligence Drill-Down
In `VisitorIntelFeed.tsx`, make each visitor row clickable. Opens a slide-out panel showing:
- Company name, org, city/region
- All pages visited, visit count, first/last seen timestamps
- Whether a lead was auto-created (with link to prospect pipeline if `pipeline_lead_id` exists)
- Link to the client's website

**NEW: "1-Click Enrich" button** in the panel. When clicked, calls a new `enrich-visitor` edge function that:
1. Takes `company_name` + `city` as input
2. Uses Firecrawl to scrape the company website (Google search → scrape contact page)
3. Extracts owner name + email + phone via regex + LLM fallback
4. Returns enriched data to the UI panel
5. Optionally creates/updates a prospect_pipeline entry with the enriched contact info

### C. SMS Copy Audit (surgical, no UI changes)
Only fix copy where it references features that don't exist or where "call" is ambiguous:

| Function | Current Copy | Fix |
|----------|-------------|-----|
| `contractor-lead-notify` | "Exclusive — call now" | **DO NOT CHANGE.** This correctly tells the contractor to call the homeowner. |
| `appointment-reminder-sender` (24h) | "Reply CONFIRM to confirm or call us to reschedule" | Change to: "Reply CONFIRM to confirm. Need to reschedule? Call us at {phone}." — removes ambiguous "or" phrasing, keeps it honest since CONFIRM reply IS handled |
| `appointment-reminder-sender` (1h) | "See you soon!" | **No change needed** — simple, correct. |
| `warranty-reminder-sender` | "Reply YES to book or call us" | **No change needed** — simple, correct. "Reply YES" is a reasonable keyword even without a full handler (it goes to inbox). |
| `slow-day-trigger` | AI-generated promo copy | Ensure the AI prompt says "end with a reply-based or link-based CTA" instead of defaulting to "call now!" in the fallback. Only the fallback string needs updating. |

### D. Kill Admin Outbox audit layer
No changes to `AdminGlobalOutbox.tsx`. The outbox stays as a timeline log.

## Files to Change

| File | Change |
|------|--------|
| New migration | Add `notify_email`, `notify_sms` to `hire_alert_clients` |
| `src/components/admin/VisitorIntelFeed.tsx` | Clickable rows + slide-out detail panel + "1-Click Enrich" button |
| New: `supabase/functions/enrich-visitor/index.ts` | Firecrawl + LLM enrichment from company name |
| `supabase/functions/appointment-reminder-sender/index.ts` | Minor 24h copy tweak (remove ambiguous "or" phrasing) |
| `supabase/functions/slow-day-trigger/index.ts` | Fix fallback promo string CTA only |

## What we are NOT changing
- `contractor-lead-notify` SMS/email copy (speed-to-lead is correct)
- `warranty-reminder-sender` copy (already fine)
- `AdminGlobalOutbox.tsx` (no audit layer)
- No "Reply RESCHEDULE" or any phantom feature copy

