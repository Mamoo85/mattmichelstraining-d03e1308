# Close out Claude's audit — 4 real fixes, 1 bogus item dropped

## Item dropped (not a real blocker)

**SUPABASE_ACCESS_TOKEN** — Already corrected in `CLAUDE.md` last turn. The primary project deploys via Lovable, not GitHub Actions. All 11 verticals (including the "5 undeployed" ones — exterior, tree, restoration, demo_junk, foundation) are live on the primary project. No Matt action needed. Skipping.

## Fixes to implement

### 1. Wire enrichment waterfall into scanners
After each successful lead insert in `trade-radar-scanner/index.ts` and `mortgage-radar-scanner/index.ts`, call `runEmailWaterfall()` from `_shared/email-waterfall.ts` to attach owner phone + email. Update lead with `owner_email`, `owner_phone`, `owner_name` columns (add columns via migration if missing on `trade_radar_leads` / `mortgage_radar_leads`). Gate on score ≥ 7 to control Apollo/Hunter spend. Persist `meta.enrichment_trace` per Core memory rule.

### 2. Voicemail audio player in MyMissedCall
- Migration: add `recording_url text` + `recording_duration int` columns to `missed_call_captures`
- Edit `missed-call-handler` edge function: capture Twilio `RecordingUrl` and `RecordingDuration` from the webhook, write to row
- `MyMissedCall.tsx`: add `<audio controls src={c.recording_url}>` next to the transcript when `recording_url` is present

### 3. DeadLeadIntake CSV self-serve upload
Add a CSV upload mode to `DeadLeadIntake.tsx`:
- Toggle between "Manual entry" and "Upload CSV"
- `<input type="file" accept=".csv">` + FileReader + simple parser (no new deps; split by line/comma)
- Column-mapping preview UI (name, phone, email, last_contact_date, trade)
- Validation (required: phone OR email) before submitting batch to existing `dead-lead-intake` edge function
- 500-lead cap matches existing edge-function cap

### 4. MyBuyerRadar CSV export
Add `RadarExportBar` (or inline blob download, same pattern as `MyMortgageRadar`) to `MyBuyerRadar.tsx`. ~20 lines.

## Files touched

```text
EDIT
  supabase/functions/trade-radar-scanner/index.ts          (enrichment hook)
  supabase/functions/mortgage-radar-scanner/index.ts       (enrichment hook)
  supabase/functions/missed-call-handler/index.ts          (capture RecordingUrl)
  src/pages/MyMissedCall.tsx                               (audio player)
  src/pages/DeadLeadIntake.tsx                             (CSV upload mode)
  src/pages/MyBuyerRadar.tsx                               (CSV export)

CREATE
  supabase/migrations/<ts>_lead_enrichment_columns.sql     (owner_email/phone/name on trade + mortgage lead tables)
  supabase/migrations/<ts>_missed_call_recording_url.sql   (recording_url + duration)
```

## Out of scope

- Team Seat / Share-a-Lead (Fix 4 in Claude's list) — needs pricing/policy decision from you first. Will ask before building.
- Trade Radar undeployed verticals — already deployed; nothing to do.

## Estimated impact

Brings Mortgage Radar + Trade Radar to ~90% (enrichment was the biggest gap), Missed-Call to ~85% (audio + transcript), Dead Lead to ~75% (self-serve unblocks signups), Buyer Radar to ~65%.

Approve and I'll ship all 4 in one pass.