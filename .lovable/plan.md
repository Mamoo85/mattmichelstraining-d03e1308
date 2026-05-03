## Plan: Enrichment KPIs, Per-Provider Budgets, Safety Circuit Breaker

Three additions on top of the existing `cold-email-rebalancer` + `outreach-leads-enrich` + `enrichment_walker_config` system.

---

### 1. Automatic KPI Tracking + Throughput Alerts

**New table** `enrichment_run_kpis` (migration):
- `id`, `run_at`, `function_name` (`outreach-leads-enrich` | `enrichment-matrix-walker`), `triggered_by` (cron|rebalancer|manual|drain)
- `leads_attempted`, `leads_enriched`, `leads_failed`, `leads_skipped` (suppressed/dup/no-domain)
- `provider_breakdown` jsonb — `{apollo:{ok,fail,cost_cents}, hunter:{...}, firecrawl:{...}, places:{...}}`
- `total_duration_ms`, `avg_ms_per_lead`, `cost_cents_total`
- `target_gap` (snapshot of remaining sends needed at run start), `throughput_per_hour`, `meets_target` boolean

**Wire-up**: `outreach-leads-enrich` already loops batches — wrap each run in a KPI accumulator, insert one row at end. Same for the walker. Use existing `lead_enrichment_audit` rows as source of truth for per-provider counts (aggregate by `run_id` we tag at start).

**Alerting** (new edge function `enrichment-kpi-monitor`, cron every 30 min 11 AM–8 PM ET):
- Compute last-2-hour throughput (sum `leads_enriched`).
- Compute current `target_gap` from rebalancer's pool view.
- Required rate = `gap / hours_left_in_window`.
- If `actual < 0.6 * required` for 2 consecutive checks → SMS Matt: `"⚠️ Enrichment throughput 42/hr vs 110/hr needed. Gap=380, 4h left."`
- Cooldown: max 1 SMS per 90 min.

**Dashboard card** on `/dwa-admin/cold-email-audit`: "Enrichment Throughput (24h)" — sparkline + last run KPIs + red badge when behind target.

---

### 2. Per-Provider Daily Budget Caps

**Schema change** to `enrichment_walker_config`:
- Replace single `daily_budget_usd` with: `apollo_daily_budget_usd` (default $30), `hunter_daily_budget_usd` (default $15), `firecrawl_daily_budget_usd` (default $5), plus existing total cap as `max_total_budget_usd` (default $200).
- Keep `daily_budget_usd` as a generated column (sum) for backward compatibility, or migrate readers.

**New view** `provider_spend_today`: rolls up `lead_enrichment_audit.cost_cents` grouped by `provider`, scoped to `created_at::date = current_date`.

**Enforcement** (in `_shared/enrichment-budget.ts` — new helper):
- `canSpend(provider, est_cents)` → checks today's spend + estimate vs that provider's cap.
- Apollo/Hunter call sites in `outreach-leads-enrich` and `email-waterfall.ts` gate every call through this. On block → log to audit with `error_code='budget_capped'`, fall through to next provider in waterfall.

**Rebalancer scaling change** (`cold-email-rebalancer`):
- Scale-up logic now bumps each provider's cap independently with per-provider headroom (Apollo max $120/day, Hunter max $60/day, Firecrawl max $20/day). Total still capped at $200.
- Decay also per-provider toward each baseline.
- SMS now reports: `"Apollo $30→$80, Hunter $15→$40 (gap=420)"`.

**Admin UI**: Cold Email Audit page gains a "Provider Budgets" card showing today's spend, cap, % used, and inline editable caps (admin only).

---

### 3. Safety Circuit Breaker

**New table** `enrichment_circuit_breaker_state`:
- `id`, `tripped_at`, `reason` (failure_rate|bounce_rate|cost_runaway), `metric_value`, `threshold`, `cleared_at`, `auto_reset_at` (default tripped_at + 6h).

**Thresholds** (configurable in `enrichment_walker_config`):
- `failure_rate_threshold` (default 0.40) — calculated from last 200 audit rows.
- `bounce_rate_threshold` (default 0.08) — calculated from `email_send_log` bounces in last 24h, scoped to leads enriched today.
- `cost_per_validated_email_threshold_cents` (default 75) — runaway cost guard.

**Evaluator** runs at the start of every rebalancer scale-up call:
1. Pull last-200 audit rows; compute `failure_rate` per provider AND overall.
2. Pull last-24h bounces from leads enriched today; compute bounce rate.
3. Compute cost-per-validated.
4. If any threshold breached → write `enrichment_circuit_breaker_state` row, set `enrichment_walker_config.budget_frozen=true`, freeze all per-provider caps at their current values (no scale-ups), SMS Matt: `"🛑 Enrichment circuit tripped: Apollo failure 47% (>40%). Budget frozen until 8 PM."`
5. Auto-reset after `auto_reset_at` if metric recovers; otherwise stays tripped and re-alerts every 4h.
6. Admin "Reset Breaker" button on dashboard (with confirm).

**Rebalancer behavior when tripped**: Still runs sender allocation (uses already-enriched supply) but skips all "scale up budget" + "trigger enrichment burst" branches. Logs `breaker_blocked: true` in response.

---

### Files Touched

**New**:
- `supabase/migrations/<ts>_enrichment_kpis_budgets_breaker.sql` (3 tables + view + config columns)
- `supabase/functions/enrichment-kpi-monitor/index.ts` + cron entry
- `supabase/functions/_shared/enrichment-budget.ts` (per-provider gate)
- `supabase/functions/_shared/enrichment-breaker.ts` (evaluator + state read/write)

**Edited**:
- `supabase/functions/outreach-leads-enrich/index.ts` — KPI accumulator, per-provider gate
- `supabase/functions/cold-email-rebalancer/index.ts` — per-provider scaling, breaker check
- `supabase/functions/_shared/email-waterfall.ts` — gate Apollo/Hunter calls
- `src/pages/admin/AdminColdEmailAudit.tsx` — Throughput card, Provider Budgets card, Breaker status + reset
- `supabase/config.toml` — register `enrichment-kpi-monitor`

**Cron**:
- `enrichment-kpi-monitor` every 30 min, 11 AM–8 PM ET

### Acceptance
- KPI row written for every enrichment run, visible on dashboard.
- Apollo overspend (e.g. $120 single run) blocked at $80 cap; Hunter still callable.
- Simulated 50% failure spike trips breaker, SMS sent, scale-ups frozen, sender allocation continues.
- Throughput shortfall for 60 min → SMS alert with required vs actual rate.
