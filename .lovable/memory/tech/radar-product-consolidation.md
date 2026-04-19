---
name: Radar Product Consolidation
description: Mapping of all radar product aliases (TechAlert/Talent/Hire/Demand/Growth/Industry Pulse) to canonical names, tables, routes, and Stripe metadata. Includes consolidation status as of 2026-04-19.
type: reference
---
# Radar Product Naming (Canonical)

DWA has 3 client-facing radar products. Multiple legacy aliases exist in code and UI — always normalize to the canonical name when adding new copy. **See `/NAMING.md` at repo root for full rules.**

| Canonical | Aliases (legacy) | Primary Table | Client Route | Admin Route | Stripe metadata.type |
|-----------|------------------|---------------|--------------|-------------|----------------------|
| **Talent Radar** | TechAlert, HireAlert, HireRadar, talent_intelligence | `hire_alert_candidates` + `hire_alert_clients` + `hire_alert_client_candidates` | `/talent-radar/dashboard?token=` (aliases `/my-techalert`, `/hire-alert`) | `/dwa-admin` → Talent Radar Clients tab | `hire_alert_subscription` |
| **Demand Radar** | (none — clean) | `demand_radar_signals` (+ shares `industry_pulse_signals` for some flows) | n/a (admin-only currently) | `/dwa-admin` → Demand Radar tab | `industry_pulse_*` (legacy — Demand Radar tiers checkout via this) |
| **Growth Radar** | Industry Pulse, Industrial Intel | `industry_pulse_signals` + `industry_pulse_clients` (canonical) | `/growth-radar` (aliases `/industry-pulse`, `/my-industry-pulse`) | `/dwa-admin` → Growth Radar tab | `industry_pulse_subscription` |

## DB Consolidation Status (2026-04-19)
- `growth_radar_signals` and `growth_radar_clients` were duplicate physical tables — **DROPPED**, recreated as compatibility VIEWS over `industry_pulse_*` with INSTEAD OF INSERT triggers.
- 8 rows backfilled from old `growth_radar_signals` into `industry_pulse_signals`.
- **Single source of truth: `industry_pulse_*` tables.** Writers using `growth_radar_*` still work via triggers.
- `security_invoker = true` set on both views to enforce RLS via the calling user.

## Sidebar labels (DWAAdmin.tsx)
- "Talent Radar Clients" (was "TechAlert Clients")
- "Growth Radar" (was "Industry Pulse")
- "Demand Radar" — new

## Universal export bar
`<RadarExportBar radar="talent|demand|growth" records={...} />` — wired into MyTechAlert, GrowthRadarDashboard, AdminDemandRadar. Provides PDF / CSV / Email draft / SMS draft.

## Background automation
- `enrichment-health-check` — hourly; SMS Matt if RED status
- `candidate-staleness-cleanup` — nightly 7am UTC; new→monitoring at 7d, →stale at 30d
- `backfill-client-candidates` — daily 10am UTC; assigns new candidates to matching clients
- `radar-weekly-digest` — Monday 12pm UTC; top 5 per client via Resend
- `growth-radar-enhanced-scan` — 9am/9pm; 8 free OSINT sources (writes to `industry_pulse_signals` via view trigger)
- `demand-radar-enhanced-scan` — 9:30am/9:30pm; 6 free OSINT sources

## Rules When Adding Code
1. **User-facing strings** (H1s, buttons, emails, SMS, page titles) → use canonical names.
2. **Code identifiers** (variables, functions, files, routes, tables, Stripe meta) → leave legacy names alone.
3. New edge functions → use canonical prefix (`talent-radar-*`, `growth-radar-*`, `demand-radar-*`).
4. New tables → use canonical schema (`talent_radar_*`, `growth_radar_*`); never reuse `hire_alert_*` or `industry_pulse_*` for net-new tables.

See `/NAMING.md` for the full reference.
