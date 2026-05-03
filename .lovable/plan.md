## Goal

Stop scaling enrichment budgets aggressively. Spend only what's needed to fill 150 sends/day. Hold this cap until DWA cold-email-sourced MRR exceeds total enrichment spend. Daily SMS reports the average cost-per-day to hit 150.

---

## Behavior changes

### 1. Frugal Mode (default ON until MRR > spend)

New flag `enrichment_walker_config.frugal_mode` (default `true`).

When ON, the rebalancer will:
- Compute **leads needed today** = `150 - sends_so_far`.
- Compute **enrichment supply gap** = `leads_needed - unsent_with_email_count`. If ≤ 0, skip all enrichment scaling (we have enough supply).
- If gap > 0, use **free-first waterfall only** (Google Places → Firecrawl → site_scrape → Hunter free tier). Apollo/Hunter paid only fire when free sources can't close the gap.
- Per-provider caps reduced to **just-enough**:
  - Apollo cap = `gap × $0.05` (Apollo cost-per-validated, ~ $7.50 for 150 leads worst case)
  - Hunter cap = `gap × $0.02` (~$3)
  - Firecrawl cap = `gap × $0.005` (~$0.75)
  - Hard ceiling = $15/day total in frugal mode.
- No "scale-up" branch runs. No SMS scale-up alerts.

### 2. MRR-vs-spend gate

New view `cold_email_economics_today`:
- `spend_today_cents` = sum of `lead_enrichment_audit.cost_cents` today
- `spend_30d_cents` = same, last 30 days
- `mrr_attributed_cents` = sum of active subscriptions where `signup_source IN ('cold_email','outreach_lead')` × monthly price
- `mrr_covers_spend` = `mrr_attributed_cents >= spend_30d_cents`

Rebalancer checks `mrr_covers_spend` at top of run:
- `false` → frugal_mode forced ON (even if admin toggled off)
- `true` → frugal_mode respects admin toggle (allows opt-in scale-up)

### 3. Daily cost-per-150 SMS (8 PM ET)

New cron `cold-email-daily-economics` (8 PM ET, after send window closes):
- Queries today's: sends_count, spend_cents, leads_enriched, replies, new_signups
- Computes: `cost_per_send = spend / sends`, `cost_per_150 = cost_per_send × 150`
- Computes 7-day rolling avg `avg_cost_per_150_7d`
- Sends SMS to Matt:
  ```
  📧 Cold Email Daily
  Sent: 148/150 ✓
  Spend: $4.20 ($0.028/send)
  Cost to hit 150: $4.26
  7d avg: $5.10/day
  30d spend: $142 | MRR cov: $0
  Mode: FRUGAL 🔒
  ```
- If `mrr_covers_spend` flips true, SMS includes: `🟢 MRR now covers spend — scale-up unlocked`.

### 4. Admin UI updates (`/dwa-admin/cold-email-audit`)

- New "Economics" card: today spend, 7d avg cost/150, 30d spend vs attributed MRR, gauge showing coverage ratio.
- Frugal Mode toggle (disabled/locked when MRR < spend, with tooltip "Locked until MRR covers spend").
- Provider budget cards now show "Frugal cap" vs "Max cap" side-by-side.

---

## Files

**New**
- `supabase/migrations/<ts>_frugal_mode_economics.sql` — adds `frugal_mode` column, `cold_email_economics_today` view, signup_source attribution on `field_crm_clients`/`hire_alert_clients`/etc.
- `supabase/functions/cold-email-daily-economics/index.ts` + cron entry

**Edited**
- `supabase/functions/cold-email-rebalancer/index.ts` — frugal-mode branch, MRR gate, skip scale-up when supply ≥ gap
- `supabase/functions/_shared/enrichment-budget.ts` — frugal-mode cap calculator
- `src/pages/admin/AdminColdEmailAudit.tsx` — Economics card + locked toggle
- `supabase/config.toml` — register new function

## Acceptance
- Default day: spend < $10, hits 150 sends, SMS at 8 PM with cost breakdown.
- Admin can't disable frugal mode while MRR=0.
- When supply > gap, Apollo/Hunter never called (zero spend).
- 7-day rolling cost-per-150 visible in SMS + dashboard.