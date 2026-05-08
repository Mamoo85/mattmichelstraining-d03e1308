
## The bug you just hit (confirmed)

In `src/components/trade-radar/TradeRadarLeadCard.tsx` line 286:

```tsx
onClick={() => window.open(`tel:${lead.owner_phone ?? ""}`, "_self")}
{lead.owner_phone ? "Call Owner" : "Call Now"}
```

When `owner_phone` is missing (which is the case for the demo/junk lead you tapped — Apollo/Hunter haven't enriched a property owner from a city demolition contract), the button opens `tel:` with an **empty string**. On Android Chrome that's a silent no-op — exactly what you saw. The button shouldn't even pretend to be callable in that state.

This is a 100% reproducible UX failure on every claimed lead without an enriched owner phone, across all 11 Trade Radar verticals (Demo/Junk especially — those are addresses, not people, so phone enrichment misses often).

## Scope: full trial-dashboard button audit

You have **25 `My*` dashboards** + landing pages + lead cards + admin tabs. I'll audit every interactive element on the trial-facing surfaces and prove each one either works or gets fixed.

### Phase A — Fix the Call Now bug (ship first, blocks nothing else)

1. `TradeRadarLeadCard.tsx`: when `owner_phone` is missing, replace the dead `tel:` button with a **"Get Owner Contact"** action that:
   - Opens a small dialog: "We're enriching this owner's contact info. We'll text you the moment it's ready (usually within 24h)." + Mark Called / Snooze / Pass actions still available.
   - Triggers a backend call to `outreach-leads-enrich` for that specific lead (priority enqueue).
   - Records the request in `trade_radar_lead_actions` so we can SLA-track.
2. When `owner_phone` IS present, keep the working `tel:` link (already fine).
3. Same fix pattern applied to any other card that has the same shape: `MyContractorLeads.tsx`, `MyMissedCall.tsx`, `MySiteRadar.tsx`, `MyTechAlert.tsx`.

### Phase B — Automated button/link inventory

Run a script that greps every `My*.tsx` + `TradeRadar*.tsx` + `LeadActionBar.tsx` and produces a CSV: `{file, line, element_type, handler, target}` for every `<button>`, `<a href>`, `onClick`, `tel:`, `mailto:`, `Link to=`, `window.open`, `navigate(`, `supabase.functions.invoke(`. Output saved to `/mnt/documents/trial_button_audit.csv` for your review.

### Phase C — Live click-through in the preview browser

Using the browser tool, log into the preview as Matt (founder seat) and walk every trial dashboard. For each:

1. Click every visible button/link.
2. Capture: did anything happen? did the network call return 2xx? did a toast/dialog appear?
3. Log issues to `/mnt/documents/trial_click_audit.md` with screenshot + repro steps.

Dashboards covered (25): all `My*.tsx` listed in the repo, plus the public trial start pages (`/start-trial?product=...`) for Foundation/Roofing/HVAC/Plumbing/Electrical/Pest/Gutters/Exterior/Tree/Restoration/Demo-Junk/Mortgage/Buyer/Demand/FieldDesk/SiteRadar/Missed-Call/TechAlert/Contractor Leads/Dead Lead/Industry Pulse/Addons/Team/Trials.

### Phase D — Fix every issue found in Phase C

Each broken handler gets fixed in-place. No commenting-out, no "TODO". For each fix I'll re-run the click test to confirm green.

### Phase E — Regression guard

Add a tiny Vitest test (`src/test/no-empty-tel.test.tsx`) that statically scans the codebase for `tel:${...?? ""}` and similar empty-fallback patterns and fails CI if any reappear. Cheap, prevents this exact bug class forever.

## Technical details

- **Files touched** (estimated):
  - `src/components/trade-radar/TradeRadarLeadCard.tsx` — Call Now fix + dialog
  - 1 new dialog component `src/components/trade-radar/RequestEnrichmentDialog.tsx`
  - `supabase/functions/outreach-leads-enrich/index.ts` — accept `priority_lead_id` param to jump the queue
  - 0–N additional `My*.tsx` fixes depending on Phase C results (could be 0, could be 10)
  - 1 Vitest regression test
- **No DB migrations** unless audit surfaces a missing column.
- **No new secrets needed.**
- **Deployment**: edge function change auto-deploys; frontend ships on next push.

## What I will NOT do

- I won't redesign the cards. Visual/style untouched.
- I won't touch any business logic outside button handlers.
- I won't ship fixes for dashboards that pass the audit clean.

## Order of operations

1. Ship Phase A (Call Now dialog) — ~15 min, immediately unblocks the screenshot bug.
2. Run Phases B + C — ~30–60 min, produces the audit deliverables.
3. Ship Phase D fixes — variable, depends on what Phase C finds.
4. Ship Phase E regression test — ~5 min.

You'll get the audit CSV + markdown report in `/mnt/documents/` so you can spot-check yourself.
