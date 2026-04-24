

# Plan — Unified Enrichment Waterfall + Re-score-with-Enrich + Per-Provider Audit

## What's already in place (no rebuild)
- `supabase/functions/_shared/email-waterfall.ts` — shared 6-stage waterfall (site_scrape → snov → apollo → pattern_verify → hunter → pdl), stop at confidence ≥50, 429 cooldown via `enrichment_provider_health`, full per-step `trace`
- `prospect-email-backfill` already uses it and returns `counters` (per-provider hit counts)
- "Backfill Emails" toast already shows breakdown (line 211–217 of OutreachCommandCenter)
- `prospect_pool.meta` jsonb exists for trace logging

## What's missing / to build

### 1. Wire the shared waterfall into `enrich-prospect-pool`
Currently `enrich-prospect-pool/index.ts` has its own `stageHunter` and ad-hoc email logic — Snov, Apollo, pattern-verify, PDL are NOT used here. Replace its email-finding block with a call to `runEmailWaterfall()` so the same ordered pipeline runs everywhere. Keep its non-email enrichment (Google reviews, Twilio carrier, HIBP, etc.) untouched. Trace entries from the waterfall get appended to `meta.enrichment_trace` in the same shape it already writes — every field gets a provider tag for audit.

### 2. New flag: re-score with enrich-first
Add `enrich_first: boolean` to `score-prospects`. When true:
- For each row that's missing email/phone/contact, call `runEmailWaterfall()` first
- Persist any fills to `prospect_pool` + append `{ts, flow:"score_with_enrich", winner, steps}` to `meta.enrichment_trace`
- Then proceed with scoring (same logic — newly-filled email/phone now contributes to the score)
- Return `{scored, enriched, counters}` so the UI can show the per-provider breakdown

### 3. UI — "Enrich missing fields first" checkbox next to "Re-score Pool"
In `OutreachCommandCenter.tsx` `FindProspects()`:
- Add `<Checkbox>` "Enrich missing fields first (slower)" next to the Re-score button
- `runScore()` passes `enrich_first` in body
- Toast becomes `Re-scored X · Enriched Y — snov:n · apollo:n · pattern_verify:n · hunter:n · pdl:n · site_scrape:n` when enrich_first is on
- Same per-provider breakdown style already used by backfill

### 4. Confirmed working / no change needed
- "Backfill Emails" toast (already shows the per-provider breakdown — line 211–217)
- Stop-at-confidence (built into the waterfall — returns at first hit ≥50)
- 429 skip / provider health (already in waterfall)
- Trace logging on `prospect_pipeline.meta.enrichment_trace` (already done by backfill)

### 5. Single small tweak to RankedPool's "Enrich All / Enrich One"
These already call `enrich-prospect-pool`. Once #1 is done, they automatically use the shared waterfall — no UI change needed, but the success toast will get richer data (`counters` from the response). I'll surface a one-line breakdown in those toasts too.

## Files to create
*(none — no new edge functions or migrations)*

## Files to edit

| File | Change |
|---|---|
| `supabase/functions/_shared/email-waterfall.ts` | Add a small `runFieldWaterfall()` wrapper that returns the same shape but also reports which fields were filled (today only `email`; structure makes phone/contact extension trivial later) |
| `supabase/functions/enrich-prospect-pool/index.ts` | Replace `stageHunter` email path with `runEmailWaterfall()`. Keep non-email stages. Trace entries for email get `source: <provider>` (snov/apollo/etc.) instead of just "Hunter" |
| `supabase/functions/score-prospects/index.ts` | Accept `enrich_first` flag. When set, call `runEmailWaterfall()` for rows missing email, persist fills + trace, then score. Return `{scored, enriched, counters}` |
| `src/components/dwa-admin/OutreachCommandCenter.tsx` | (a) Add `enrichFirst` checkbox next to Re-score button. (b) Pass `enrich_first` in `runScore()`. (c) When `enrich_first`, expand toast with per-provider breakdown (same format as backfill). (d) Expand `enrichOne` / `enrichAll` toasts to include counters when present |

## Verification (after build)
1. Curl `score-prospects` with `{enrich_first:true, limit:5}` → expect `{ok, scored, enriched, counters}`
2. Curl `prospect-email-backfill` (sanity, unchanged) → still returns counters
3. Open `prospect_pipeline` / `prospect_pool` row that just got enriched → confirm `meta.enrichment_trace` has new entry with `winner: <provider>` and `steps: [{source, ok}, …]`
4. UI smoke: check checkbox, click Re-score Pool → toast reads `Re-scored N · Enriched M — snov:x · apollo:y · …`

## Honest scope
~45 min. One ship. Single shared waterfall, audit trail on every fill, one new admin checkbox, richer toasts everywhere.

## Not touching
- Provider order / confidence thresholds (already correct per spec)
- Backfill toast (already breakdown-style)
- Provider health / 429 logic (already in shared module)
- Other enrichment fields beyond email (out of scope — phone/contact stays on `enrich-prospect-pool`'s existing per-stage logic)

