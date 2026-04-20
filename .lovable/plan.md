

## Full DWA Admin Audit + Agent Upgrade Plan

The DWA Admin has **40 tabs** across 7 sidebar groups, calling **~100 distinct edge functions**, with security findings that need fixing alongside the orphan/cron audit. I cannot blindly click 40 tabs and 100 buttons in one shot — I need a structured sweep. Here's how I'll do it.

### Phase 1 — Orphan Sweep (read-only, ~30 min)
Walk every DWAAdmin tab in order. For each, verify:
- The lazy import resolves (component exists)
- Every button on the tab calls a function that exists in `supabase/functions/`
- That function appears in a working cron OR is admin-triggered (intentional)
- The tables it reads/writes still exist with the columns the UI expects

Output: a single **Orphan Report** table with columns: Tab → Component → Status (✅ wired / ⚠️ partial / 🔴 broken / 👻 orphan) → Root cause → Fix recommendation.

Tabs being audited: Overview, Revenue, Agent Toolkit, Talent Radar, Demand Radar, HVB, Medicare Intel, Industrial Intel, TechAlert Prospects, Growth Signals, Coverage Map, Dead Leads, Contractor Leads, FieldDesk, All Clients, CRM Dashboard, Postcards, Postcard Ops, Faxes, Targeting, Outbox, Agency Outreach, Supplier Outreach, Visitor Intel, The Wire, Trojan Log, Field Stats, Jobs, Simulation, Service Health, Cron Sentinel, Compliance, LARA Health, Labs, Assets, Contracts, Import, Command Deck, Playbook, Strategy, Sales Guide.

### Phase 2 — Live Edge-Function Health Check (~20 min)
Use `supabase--curl_edge_functions` to ping every "scan/info" button function (the user's specific concern):
- `medicare-staffing-intel` (multi-state)
- `industrial-growth-intel`, `boiler-sector-intel`
- `apify-thomasnet-pull`, `lara-accela-scraper`, `lara-business-scraper`
- `hire-alert-scanner`, `industry-pulse-scanner`
- `candidate-deep-enrich`, `lead-enrichment-waterfall`, `enrich-candidate-manual`
- `cron-sentinel`, `compliance-stats`, `agent-smith-report`
- `high-volume-buyer-digest`, `dataforseo-maps-search`
- `agency-outreach-draft`, `generate-audit-pitch`, `generate-digital-audit`
- `pulse-sms-monitor`, `endpoint-drift-detector`
- `openrouter-research`, `omni-lead-engine`, `hybrid-prospector`
- `enrich-postcard-addresses`, `send-postcards`, `enrich-visitor`

For each: capture status code + error + recent log line. Report.

### Phase 3 — Cron Audit (~15 min)
Query `cron.job` via SECURITY DEFINER helper or `supabase--read_query`. For each cron:
- Is the URL hardcoded (good) or vault-lookup (broken — see memory `mem://tech/cron-sentinel-and-monitoring`)
- Does the target function exist
- Last-run status from `cron.job_run_details`
- Identify any cron firing but producing 0 rows for ≥3 consecutive runs

Cross-reference against `cron-sentinel` watchlist to find crons that exist but aren't being watched, and watched names that don't match real cron jobs.

### Phase 4 — Agent Upgrades (research + apply)
For every agent under `.claude/agents/` and the autonomous edge functions (`tom-autonomous`, `oz-autonomous`, `scarlett-autonomous`, `selma-autonomous`, `ops-autonomous`, `dwa-operator`, `dwa-closer`):
- Confirm heartbeat is firing (read `agent_heartbeats` table)
- Confirm cron is wired
- Apply 3 targeted upgrades: (a) all OpenRouter calls use `perplexity/sonar-pro` for research (we paid for it), (b) every agent writes structured output to `agent_run_log` so the Agent Board UI is honest, (c) cost-aware `cheap-extract` adapter swap for any agent doing simple JSON extraction (memory rule).

### Phase 5 — Critical Fixes Applied This Round
Limit fixes to high-leverage wins (full repair of every orphan would take 2 weeks). Targets:
1. **Security findings (4 RLS errors)** — `hire_alert_client_candidates`, `industry_pulse_clients`, `search_query_log` policies scoped to `public` instead of `service_role`. One migration fixes all three. Plus the SECURITY DEFINER view (`security--manage_security_finding`).
2. **Any 🔴 broken scan button found in Phase 1/2** — fix in place (same pattern as Medicare CMS field rename).
3. **Cron Sentinel watchlist** — sync with actual `cron.job` names so we stop getting false "missing" alerts.
4. **One missing `IntelRowActions` integration** — apply to any market-intel result table that doesn't have it yet (HVB, Growth Signals, TechAlert Prospects).

### Phase 6 — Click-Through Verification
Use `browser--navigate_to_sandbox` + `browser--act` to click the top 8 highest-revenue scan buttons (Medicare scan, Industrial scan, Boiler scan, ThomasNet pull, LARA scan, MIOSHA scan, HVB digest, Demand Radar scan). Capture screenshots of result tables so I can confirm rendering, not just HTTP 200s.

### Deliverable
A single response with:
- 📋 **Orphan Report table** (one row per tab)
- 🩺 **Edge-Function Health Report** (status + log excerpt per function)
- ⏰ **Cron Audit Report** (all jobs + sentinel sync diff)
- 🤖 **Agent Upgrade Report** (heartbeat status + applied upgrades)
- 🛡️ **Security fixes shipped** (1 migration + finding marks)
- 🔧 **Files edited** (kept minimal — orphan repair will be a follow-up if any tab is fully broken)
- 📸 **Screenshots** from the click-through pass

### What I will NOT do this pass
- I will NOT delete orphaned components — I'll flag them for your review first (some are intentionally dormant)
- I will NOT rebuild any edge function from scratch — only field-name / param fixes inline
- I will NOT touch M2 Training admin (`/admin`) — DWA only, per your scope
- I will NOT add new features unrelated to fixing what's already there

### Risk
This is a 90-minute audit. Some tabs likely depend on tables that no longer exist (e.g. `crm_visitor_events`, old prospector tables). Where I find a dead table, I'll flag it instead of silently dropping the tab. If the audit reveals 10+ broken tabs, I'll stop fixing and surface a triage list for you to prioritize before I burn cycles patching low-traffic ones.

