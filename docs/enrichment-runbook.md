# Enrichment Runbook

End-to-end operations guide for the contractor outreach enrichment pipeline.

## At a glance

| Layer | Where | Purpose |
|---|---|---|
| Waterfall | `_shared/email-waterfall.ts` | 6-stage provider order: Snov → Apollo → pattern-verify → Hunter → PDL → site_scrape |
| Walker | `enrichment-matrix-walker` (every 30m) | Autonomous trade × city discovery, respects daily budget cap |
| Backfill | `contractor-outreach-enrich-backfill` (3am ET) | DLQ retries in confidence-priority order, ages out >7d to suppression |
| Alerts | `outreach-alert-evaluator` (every 5m) | Threshold + cost-anomaly checks, quiet-hours filter |
| Canary | `enrichment-e2e-verify` (4am ET) | Nightly synthetic enrichment health probe |
| Prune | `prune_enrichment_provider_latency()` (2:30am ET) | Drops latency samples >30 days |

## Admin surfaces

All in **Admin → Outreach Observability** (`/admin/outreach-observability`):

- **Dashboard** – top-line provider error rates, backlog, send velocity.
- **Live queue** – currently in-flight enrichment jobs.
- **DLQ & Backfill** – dead-lettered prospects, aged-suppression counter, manual retry.
- **Walker & Alerts** – walker run history, latency p50/p95/p99, daily spend tile, daily budget editor, alert log with 🌙 quiet-hour badges.
- **Timeline** – per-prospect waterfall trace (every provider attempt with hit/miss/error/latency).
- **Targets & Cooldowns** – add/remove walker targets (trade × city), reset stuck alert cooldowns.

## Common operations

### Add a new walker target
1. Targets & Cooldowns tab → fill trade (lowercase, e.g. `plumber`), city (e.g. `Detroit`).
2. Set priority (1=highest), max prospects per run, daily $ cap, optional notes.
3. Walker picks it up on next 30-minute tick.

### Pause autonomous walking
- Targets tab → click **enabled** chip on a row to flip to **paused**, OR
- Walker & Alerts tab → set the global daily budget to `0` to halt all walking.

### A flood of warn alerts
- Quiet hours (9pm–7am ET) auto-suppress `warn`-level. `crit` always pages.
- If a true `warn` is paging repeatedly, raise its threshold in `enrichment_alert_thresholds` or extend `cooldown_minutes`.

### Cost anomaly fired (>2× 7-day avg)
1. Walker & Alerts → spend tile shows today's total.
2. Drill into `enrichment_provider_spend_daily` view to identify the provider/day.
3. If legit (e.g. new walker target ramping), reset the cooldown to silence repeat pages.
4. If runaway, lower walker daily budget or pause the offending target.

### Prospect stuck in DLQ
- DLQ & Backfill tab shows current DLQ + aged-suppression count.
- Manual retry via panel button.
- After 7 days it auto-moves to `suppression_reason='dlq_aged_unenrichable'` (no further attempts).

### Reset a stuck cooldown
- Targets & Cooldowns tab → bottom table → **Reset** on the alert kind.
- Next evaluator tick (≤5 min) will re-page if the underlying condition still trips.

### Confidence scoring
- `enrichment_confidence` (0–100) on `contractor_outreach_prospects`.
- +40 verified email · +15 phone · +10 high-trust source.
- Backfill processes high-confidence prospects first.
- Use as outreach priority when manually triaging.

## Cron inventory (enrichment)

| Job | Schedule | Function |
|---|---|---|
| `enrichment-matrix-walker-30m` | `*/30 * * * *` | enrichment-matrix-walker |
| `outreach-alert-evaluator-5m` | `*/5 * * * *` | outreach-alert-evaluator |
| `enrichment-backfill-nightly` | `0 7 * * *` (3am ET) | contractor-outreach-enrich-backfill |
| `enrichment-e2e-verify-nightly` | `0 8 * * *` (4am ET) | enrichment-e2e-verify |
| `enrichment-latency-prune-nightly` | `30 6 * * *` (2:30am ET) | `prune_enrichment_provider_latency()` |
| `vacuum-enrichment-tables-nightly` | `0 9 * * *` | VACUUM |

## Admin RPCs

| RPC | Purpose |
|---|---|
| `set_walker_daily_budget(usd numeric)` | Update global daily Apollo/Hunter spend ceiling |
| `upsert_walker_target(trade, city, ...)` | Add or update a walker target |
| `delete_walker_target(trade, city)` | Remove a walker target |
| `reset_alert_cooldown(kind)` | Allow an alert to re-fire on next tick |
| `prune_enrichment_provider_latency()` | Manually drop >30d latency samples |

## Key tables / views

- `contractor_outreach_prospects` – primary table; `enrichment_confidence`, `suppressed_at`, `suppression_reason`
- `enrichment_dead_letter` – failed enrichment attempts
- `enrichment_walker_targets` – trade × city queue
- `enrichment_walker_config` – `daily_budget_usd` and other knobs
- `enrichment_walker_runs` – walker execution log
- `enrichment_provider_latency` (+ `_live` view) – per-provider latency samples
- `enrichment_provider_spend_daily` – view: per-day cost roll-up
- `outreach_alerts_log` – every alert ever fired
- `outreach_alert_cooldowns` – current cooldown state per alert kind
- `enrichment_alert_thresholds` – warn/crit thresholds + cooldown_minutes
- `enrichment_e2e_runs` – nightly canary results

## Compliance notes

- TCPA quiet hours (8am–9pm local) enforced in `_shared/twilio.ts` for outbound SMS.
- Internal alert quiet hours (9pm–7am ET) only suppress `warn`; `crit` always sends.
- All alert SMS go to `ADMIN_PHONE` (Matt personal), never customer-facing.
