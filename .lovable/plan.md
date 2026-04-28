# Wave 5 — Alert Hygiene, DLQ Aging, Confidence Scoring & Budget Guards

Five tightly-scoped enhancements that close the remaining safety/prioritization gaps from Sprints G–L. All changes additive — no breaking schema or behavior shifts.

---

## 1. Quiet-hours filter for warn-level alerts (9pm–7am ET)

Goal: Stop waking Matt up for non-critical noise. Warn alerts queue silently; crit always pages.

**Edge change** — `supabase/functions/outreach-alert-evaluator/index.ts`
- Add `isQuietHoursET()` helper: convert `now()` to America/Detroit; return true if hour ≥ 21 or < 7.
- Before the `if (t.sms_enabled)` SMS block:
  - If `severity === "warn"` and `isQuietHoursET()`: skip `sendSMS`, set `smsSent = false`, mark `meta.suppressed_by_quiet_hours = true`.
  - `crit` alerts continue to call `sendSMS({ allowQuietHours: true })` unchanged.
- Append the suppressed entry to `outreach_alerts_log` so it's still visible in the UI (with the meta flag).

**UI** — `src/components/admin/EnrichmentWalkerAlertsPanel.tsx`
- In the "Recent alerts fired" list, render a 🌙 badge when `meta.suppressed_by_quiet_hours` is true.

---

## 2. DLQ aging → suppression after 7 days

Goal: Stop infinitely retrying prospects that are truly unenrichable; keep the queue from bloating.

**Migration** — new `add_dlq_aging.sql`
- Add `suppressed_at timestamptz` and `suppression_reason text` columns to `contractor_outreach_prospects` (if not already present).
- Partial index `idx_dlq_aging` on `enrichment_dead_letter (created_at)` where unresolved.

**Edge change** — `contractor-outreach-enrich-backfill/index.ts`
- New phase at top of run (before replay loop):
  - Select `enrichment_dead_letter` rows older than 7 days that are not resolved.
  - For each: update parent prospect `suppressed_at = now()`, `suppression_reason = 'dlq_aged_unenrichable'`.
  - Mark the DLQ row as resolved with note `aged_to_suppression`.
- Backfill replay loop already filters out suppressed prospects via the existing "missing fields" query — add explicit `.is('suppressed_at', null)` guard.
- Return `{ aged_count }` in the response payload.

**UI** — `EnrichmentDLQPanel.tsx`
- Add a "Suppressed (aged)" counter card pulling `count(*) where suppression_reason = 'dlq_aged_unenrichable'`.

---

## 3. `enrichment_confidence` score (0–100) on prospects

Goal: Sort retries and outreach by likelihood of payoff. Low-confidence prospects get deprioritized; high-confidence go to the front.

**Migration**
- `ALTER TABLE contractor_outreach_prospects ADD COLUMN enrichment_confidence smallint DEFAULT 0 CHECK (enrichment_confidence BETWEEN 0 AND 100);`
- Index: `CREATE INDEX idx_prospects_confidence ON contractor_outreach_prospects (enrichment_confidence DESC) WHERE suppressed_at IS NULL;`

**Scoring rule** (computed at end of `_shared/email-waterfall.ts` `runEmailWaterfall`):
- Start at 0. Add:
  - +40 if verified email present
  - +20 if owner full name found
  - +15 if phone number present
  - +10 if domain confirmed reachable (no scrape error)
  - +10 if pattern-verify or Hunter/PDL hit (high-trust source)
  - +5 if Apollo confirmed company match
- Persist via the existing prospect update step.

**Consumers**
- `contractor-outreach-enrich-backfill`: `.order('enrichment_confidence', { ascending: false })` so the most likely-to-succeed retries run first within the `HARD_MAX` budget.
- Outreach selection (existing dispatcher that picks daily SMS/email targets — locate via `rg "contractor_outreach_prospects" supabase/functions | rg -i "order|select.*limit"`): also order by confidence desc so paid sends prioritize high-confidence leads.

**UI** — `EnrichmentTimelinePanel.tsx`
- Show confidence as a colored chip per prospect (green ≥70, amber 40–69, red <40).

---

## 4. Cost-anomaly alert (daily spend > 2× 7-day rolling avg)

Goal: Catch a runaway cron / pricing change / loop bug before it burns the month's budget.

**View** — new migration adds `enrichment_provider_spend_daily`:
```sql
CREATE OR REPLACE VIEW enrichment_provider_spend_daily AS
SELECT date_trunc('day', ran_at)::date AS day,
       SUM(cost_estimate_usd)::numeric(10,2) AS spend_usd
FROM enrichment_walker_runs
GROUP BY 1;
```
(Plus equivalent rollup if `email-waterfall` writes per-call spend rows — extend the union accordingly.)

**Edge change** — `outreach-alert-evaluator/index.ts`
- Add a hard-coded check kind `daily_spend_anomaly` (does not need a row in `enrichment_alert_thresholds`):
  - `today_spend = sum where day = today_ET`
  - `avg7 = sum where day in last 7 prior days / 7`
  - If `avg7 >= 1.0` (avoid div-by-near-zero noise) AND `today_spend > 2 * avg7` AND `today_spend > 5`:
    - Fire `crit` SMS: `[Cost spike] $X today vs $Y 7-day avg (Nx).`
    - Use existing cooldown table with `kind='daily_spend_anomaly'`, 4-hour cooldown.
    - Always `allowQuietHours: true` (financial = critical).
  - Log to `outreach_alerts_log`.

**UI** — `EnrichmentWalkerAlertsPanel.tsx`
- New "Spend (today vs 7-day avg)" tile at the top of the panel.

---

## 5. Walker daily budget cap (default $50/day, configurable)

Goal: Hard ceiling on autonomous spend per UTC-or-ET day, separate from per-run cap.

**Migration**
- New table `enrichment_walker_config (key text primary key, value_numeric numeric, value_text text, updated_at timestamptz default now())`.
- Seed row: `('daily_budget_usd', 50, null, now())`.
- RLS: service_role + admin via `has_role()`; no public access.

**Edge change** — `enrichment-matrix-walker/index.ts`
- After the existing per-pair budget check, add a global daily-cap check:
  - Read `daily_budget_usd` from `enrichment_walker_config` (fallback 50 if missing).
  - Sum `cost_estimate_usd` from `enrichment_walker_runs` where `ran_at >= today 00:00 ET`.
  - If `today_total >= daily_budget`: insert a walker run row with `skipped_reason='daily_budget_cap_hit ($X/$Y)'`, return `{ ok: true, skipped: "daily_budget" }`.
  - If `today_total + projected_run_cost > daily_budget`: trim `HARD_MAX_RUN_COST_USD` for this run to remaining headroom (or skip if headroom < $1).

**UI** — `EnrichmentWalkerAlertsPanel.tsx`
- New "Today's walker spend" progress bar: `today_total / daily_budget_usd` with editable input (admin-only) that updates the config row via a small RPC `set_walker_daily_budget(usd numeric)`.

---

## Files Changed (summary)

**Migrations (1 file)**
- `add_wave5_dlq_confidence_budget.sql` — DLQ aging cols, confidence col + index, walker_config table, spend_daily view, RPC `set_walker_daily_budget`.

**Edge functions**
- `outreach-alert-evaluator/index.ts` — quiet-hours filter + cost-anomaly check
- `contractor-outreach-enrich-backfill/index.ts` — DLQ aging phase + confidence-ordered replay
- `enrichment-matrix-walker/index.ts` — daily budget cap
- `_shared/email-waterfall.ts` — confidence scorer

**UI**
- `EnrichmentWalkerAlertsPanel.tsx` — quiet-hours badge, spend tile, walker budget bar
- `EnrichmentDLQPanel.tsx` — aged-suppression counter
- `EnrichmentTimelinePanel.tsx` — confidence chips

**No changes to:** routes, auth, RLS on existing tables, cron schedules (existing 5-min evaluator + 30-min walker cadence handles all five features).

---

## Out of scope (intentionally)

- Per-provider budget caps (separate Apollo/Hunter ceilings) — deferred until we have ≥30 days of latency/spend baseline data.
- Auto-tuning confidence weights via ML — current rule-based scorer is sufficient for sort ordering.
- Self-service quiet-hours window editor (hardcoded 21:00–07:00 ET) — add UI later if you need to adjust seasonally.

Reply **Approve** to ship.