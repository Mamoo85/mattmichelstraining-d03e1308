

Let me explore the current state of these three products to ground the plan.
<lov-tool-use id="toolu_vrtx_01P5PPeV6vvkeLQSCjTdhRGt" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"src/pages\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_017W7fg1LFDVP45dTsrYGNej" name="code--search_files" integration-id="code" data="{\"query\": \"demand_radar|DemandRadar|GrowthRadar|industry_pulse|IndustryPulse\", \"include_patterns\": \"src/**/*.tsx,src/**/*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_013t1U9YHwpRRoXcYthFnBYr" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"src/**/*.tsx,src/**/*.ts\", \"query\": \"DemandRadar|GrowthRadar|IndustryPulse|TalentRadar|MyTechAlert\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01FVRWtF193AUX6cZALTtjQs" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"src/components/admin\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Nezf9HY5JFDxhWYXn7cKUs" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"src/components/dwa-admin\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01FfEm4b5DVgh3ydxZfmKX2N" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT signal_type, COUNT(*) AS total, COUNT(*) FILTER (WHERE detected_at > now() - interval '7 days') AS last_7d, COUNT(*) FILTER (WHERE detected_at > now() - interval '1 day') AS last_24h FROM industry_pulse_signals GROUP BY signal_type ORDER BY total DESC;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01SxxZVvTsW4y6G1VZABM2Cw" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/dwa-admin/AdminDemandRadar.tsx\", \"lines\": \"1-80\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_019iunFSrETMuqKLK11scthm" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/DWAAdmin.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01MfMJhDA58p4nzHKJrkJupc" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT\\n  (SELECT COUNT(*) FROM hire_alert_runs WHERE run_at > now() - interval '24 hours') AS talent_runs_24h,\\n  (SELECT COUNT(*) FROM hire_alert_runs WHERE run_at > now() - interval '7 days') AS talent_runs_7d,\\n  (SELECT COUNT(*) FROM hire_alert_candidates WHERE created_at > now() - interval '7 days') AS talent_cands_7d,\\n  (SELECT COUNT(*) FROM industry_pulse_signals WHERE detected_at > now() - interval '7 days') AS demand_signals_7d,\\n  (SELECT COUNT(*) FROM industry_pulse_signals WHERE detected_at > now() - interval '24 hours') AS demand_signals_24h,\\n  (SELECT COUNT(*) FROM industry_pulse_signals) AS demand_signals_total,\\n  (SELECT COUNT(*) FROM industry_pulse_clients WHERE active=true) AS demand_clients_active;\"}">
</lov-tool-use>
I have enough context. The user wants: (1) a unified "Talent Radar Hub" tab with an open log, (2) Demand Radar promoted to a real hub with the same depth, plus throughput math (avg signals/day, sellable inventory). Growth Radar/Industry Pulse are still alive but live under the Demand Radar umbrella per the consolidation memo — need to surface that.

<lov-plan>

## What's actually broken in the UI

Right now in `/dwa-admin` sidebar:
- **Talent Radar** = single tab (`AdminHireAlertClients`) — clients list + scanner runs jammed together. No open log of *where it's failing*. No clear separation from Demand.
- **Demand Radar** = single tab (`AdminDemandRadar`) — 100-row signal list, that's it. No throughput math, no source breakdown, no Growth Radar / Industry Pulse surfaced (they're hidden under the same `industry_pulse_signals` table per the consolidation memo).
- **High-Volume Buyers** floats off on its own — it's actually a Demand Radar sub-product.

Real DB inventory I just pulled:
- Talent Radar: 167 candidates / 7d, 97 scanner runs / 24h
- Demand Radar: 131 signals total (79 hiring, 36 expansion, 11 school RFPs, 5 permit surge), 20/24h, 131/7d
- Demand clients active: 1
- Growth Radar = view over `industry_pulse_signals` (per memo) — currently invisible in admin
- Industry Pulse = view over `industry_pulse_signals` — also invisible

## Plan — 3 product hubs, each with its own tabbed shell + live log

### A. Talent Radar Hub (`techalert` tab → rebuild as 4 sub-tabs)
**File:** new `src/components/dwa-admin/TalentRadarHub.tsx` wrapping existing components
- **📋 Clients** — existing `AdminHireAlertClients` clients table only
- **🎯 Workbench** — existing `CandidateWorkbench` (already built, just lift it out)
- **📡 Scanner Runs** — existing run history strip from `AdminHireAlertClients`, expanded to show per-source success/fail/found counts, last-run-age, error messages
- **🔴 Live Log (NEW)** — `TalentRadarLiveLog.tsx`: tails `hire_alert_runs` + `candidate_enrichment_log` + `enrichment_health_log` in one chronological feed. Color-coded (green=ok, amber=0 results, red=error). Filters: source, status, last 1h/24h/7d. This is the "open log so I can see where its messing up" the user asked for. Auto-refresh every 30s.

### B. Demand Radar Hub (`demand-radar` tab → rebuild as 5 sub-tabs)
**File:** new `src/components/dwa-admin/DemandRadarHub.tsx`
- **📊 Throughput Dashboard (NEW)** — top-of-page KPI strip:
  - Signals/day (7-day avg) + sparkline
  - Days of inventory at current sell rate
  - "Sellable now" count (confidence ≥ 7, < 30 days old, not yet sold)
  - Per-signal-type breakdown (hiring 79 / expansion 36 / RFP 11 / permit_surge 5)
  - Per-vertical breakdown (industrial / steel / plumbing supply / etc.)
  - Revenue forecast: `sellable × $50 avg` and `monthly_run_rate × $199 subscription`
- **📡 Signals Feed** — existing `AdminDemandRadar` signal list (full functionality preserved)
- **🌱 Growth Radar** — filtered view: `signal_type IN ('expansion','rd_grant','sba_loan','new_business_entity')`. Same UI as signals feed, scoped. Now visible again.
- **🏭 Industry Pulse** — filtered view: `signal_type IN ('hiring','permit_surge','school_rfp')`. The HVB ($199/mo) sub-product feeds from this slice.
- **🔴 Live Log (NEW)** — `DemandRadarLiveLog.tsx`: tails the 6 demand-radar scanner edge functions (`industry-pulse-scanner`, `demand-radar-enhanced-scan`, `sam-gov-mi-pull`, `medicare-staffing-intel`, `industrial-growth-intel`, `growth-radar-enhanced-scan`) via `agent_heartbeats` + a new `demand_radar_runs` log table. Same color coding as Talent.

### C. Sidebar reorg (`DWAAdmin.tsx`)
Reshuffle the "Customers" + "Intel" groups into a clear **"Radars"** group:
```
RADARS
  🎯 Talent Radar
  📈 Demand Radar
  📦 High-Volume Buyers   (move here from Customers — it's a Demand sub-product)
```
Move the existing `techalert` clients tab content under Talent Radar Hub > Clients sub-tab. HVB stays its own tab but sidebar groups it correctly so it's obvious it pairs with Demand.

### D. New tiny migration
```sql
create table if not exists demand_radar_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz default now(),
  source text not null,        -- which scanner
  signals_found int default 0,
  signals_new int default 0,
  errors text,
  status text default 'ok',
  duration_ms int
);
```
Wire the 6 demand scanners to insert one row per run (mirrors `hire_alert_runs` pattern).

## Files I'll touch
- NEW: `src/components/dwa-admin/TalentRadarHub.tsx`
- NEW: `src/components/dwa-admin/TalentRadarLiveLog.tsx`
- NEW: `src/components/dwa-admin/DemandRadarHub.tsx`
- NEW: `src/components/dwa-admin/DemandRadarLiveLog.tsx`
- NEW: `src/components/dwa-admin/DemandThroughputKPIs.tsx`
- EDIT: `src/pages/DWAAdmin.tsx` (sidebar reorg + wire hubs)
- EDIT: `supabase/functions/industry-pulse-scanner/index.ts` (+5 sister scanners): one INSERT per run into `demand_radar_runs`
- NEW migration: `demand_radar_runs` table + RLS
- (Talent already logs to `hire_alert_runs` — just surface it)

## What I will NOT do
- Won't change pricing or product names (per the radar consolidation memo, canonical names stay)
- Won't break existing `MyTechAlert` / `MyIndustryPulse` client-facing pages
- Won't add new scanners — just expose what's running

## Success criteria
- `/dwa-admin` sidebar shows a **Radars** group with 3 distinct hubs
- Each hub has a **🔴 Live Log** sub-tab showing color-coded runs with auto-refresh
- Demand Radar Throughput tab shows: "X signals/day avg · Y days of inventory · Z sellable now · $N forecast"
- Growth Radar + Industry Pulse are visibly accessible as filtered sub-tabs under Demand Radar (no more "where did those features go?")

