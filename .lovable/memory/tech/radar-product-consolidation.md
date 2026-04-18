---
name: Radar Product Consolidation
description: Mapping of all radar product aliases (TechAlert/Talent/Hire/Demand/Growth/Industry Pulse) to canonical names, tables, and routes
type: reference
---
# Radar Product Naming (Canonical)

DWA has 3 client-facing radar products. Multiple legacy aliases exist in code and UI — always normalize to the canonical name when adding new copy.

| Canonical | Aliases (legacy) | Primary Table | Client Route | Admin Route |
|-----------|------------------|---------------|--------------|-------------|
| **Talent Radar** | TechAlert, HireAlert, HireRadar | `hire_alert_candidates` + `hire_alert_clients` + `hire_alert_client_candidates` | `/talent-radar/dashboard?token=` (alias `/my-techalert`) | `/dwa-admin` → Talent Radar Clients tab |
| **Demand Radar** | (none — new) | `demand_radar_signals` | n/a (admin-only currently) | `/dwa-admin` → Demand Radar tab |
| **Growth Radar** | Industry Pulse, Industrial Intel | `industry_pulse_signals` | `/my-industry-pulse` | `/dwa-admin` → Growth Radar tab |

## Sidebar labels (DWAAdmin.tsx)
- "Talent Radar Clients" (was "TechAlert Clients")
- "Growth Radar" (was "Industry Pulse")
- "Demand Radar" — new

## Universal export bar
`<RadarExportBar radar="talent|demand|growth" records={...} />` — wired into MyTechAlert, GrowthRadarDashboard, AdminDemandRadar. Provides PDF / CSV / Email draft / SMS draft.

## Background automation
- `enrichment-health-check` — hourly; SMS Matt if RED status
- `candidate-staleness-cleanup` — nightly 7am UTC; new→monitoring at 7d, →stale at 30d
- `backfill-client-candidates` — daily 10am UTC; assigns new candidates to matching clients (fixes "no names in dashboard" bug)
- `radar-weekly-digest` — Monday 12pm UTC; top 5 per client via Resend
- `growth-radar-enhanced-scan` — 9am/9pm; 8 free OSINT sources
- `demand-radar-enhanced-scan` — 9:30am/9:30pm; 6 free OSINT sources
