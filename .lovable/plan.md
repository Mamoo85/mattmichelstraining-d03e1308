

## Naming Audit — Radar Product Confusion

You're right — there's significant tangle. Here's the full picture and my proposed cleanup.

### What canonical names should be (per existing memory)
| Canonical | Purpose |
|---|---|
| **Talent Radar** | Hiring intelligence (trades + healthcare) |
| **Demand Radar** | Buyer-intent signals |
| **Growth Radar** | Industry expansion / regulatory pulse |

### What's actually in the codebase (the mess)

**Talent Radar has 4 active aliases:**
- `TechAlert` — 40+ files (UI strings, component names, page titles)
- `HireAlert` — 40+ files (route paths, page filenames, edge functions)
- `Talent Radar` — the new canonical (routes + some new UI)
- `talent_intelligence` — old redirect

**Growth Radar has 2 names mixed:**
- `industry_pulse` — DB tables (`industry_pulse_signals`, `industry_pulse_clients`), page files (`IndustryPulse.tsx`, `MyIndustryPulse.tsx`), edge functions
- `growth_radar` — DB tables (`growth_radar_signals`, `growth_radar_clients` — DUPLICATES exist), routes

**Demand Radar:** clean (only one name).

### The 4 real risks I found

1. **Two parallel DB tables for Growth Radar** — `industry_pulse_signals` AND `growth_radar_signals` both exist. Writers/readers may be split between them → silent data loss.
2. **Page file names lie about identity** — `MyTechAlert.tsx` is rendered at `/talent-radar/dashboard`. `HireAlert.tsx` is rendered at `/talent-radar`. Future devs (or Claude/Lovable) will grep for "talent-radar" and miss everything.
3. **Stripe metadata is still `hire_alert_subscription`** — webhook routing, customer history, refunds all keyed to legacy name. Touching this is risky (existing subscribers).
4. **UI copy inconsistent** — admin tabs say "TechAlert", client emails say "Talent Radar", SMS says "HireAlert". Clients see 3 different product names for the same thing.

### Proposed Cleanup (4 phases — surgical, low-risk)

**Phase 1 — UI/Copy normalization (zero-risk, ~30 min)**
- Replace every user-facing string "TechAlert" / "HireAlert" → "Talent Radar"
- Replace user-facing "Industry Pulse" → "Growth Radar"
- Scope: page H1s, button labels, email subjects, SMS bodies, admin tab labels, SEO titles
- DOES NOT touch: file names, route paths, table names, Stripe metadata, function names

**Phase 2 — DB consolidation for Growth Radar (medium-risk, needs migration)**
- Pick one: keep `industry_pulse_*` (more data, older) OR migrate to `growth_radar_*`
- Create views so old code keeps working: `CREATE VIEW industry_pulse_signals AS SELECT * FROM growth_radar_signals` (or vice versa)
- Backfill any rows in the abandoned table → consolidate, then deprecate

**Phase 3 — Rename page files + components (low-risk, mechanical)**
- `HireAlert.tsx` → `TalentRadar.tsx`
- `MyTechAlert.tsx` → `TalentRadarDashboard.tsx`
- `HireAlertTrial.tsx` → `TalentRadarTrial.tsx`
- `IndustryPulse.tsx` → `GrowthRadar.tsx`
- `MyIndustryPulse.tsx` → `GrowthRadarDashboard.tsx` (already partially exists — merge)
- Update imports in `App.tsx` only — routes stay identical

**Phase 4 — Leave alone (high-risk, touch only if needed)**
- DB table `hire_alert_*` → keep. Add a memory note that these are the canonical Talent Radar tables.
- Stripe metadata `hire_alert_subscription` → keep. Add comment in webhook: `// legacy name = Talent Radar`
- Edge function names (`hire-alert-scanner`, etc.) → keep. Renaming breaks crons.
- Legacy redirect routes (`/hire-alert` → `/talent-radar`) → keep for SEO/email links.

### Single source of truth (after cleanup)

I'll write a `NAMING.md` at repo root + update `mem://tech/radar-product-consolidation` so every future session knows:

```
USER SEES → "Talent Radar", "Demand Radar", "Growth Radar"  
CODE USES → routes /talent-radar/*, /demand-radar, /growth-radar  
DB USES   → hire_alert_* (Talent), demand_radar_*, growth_radar_*  
STRIPE    → hire_alert_subscription = Talent Radar (legacy key, do not change)
```

### Open question before I build

**Question:** Phase 2 — for Growth Radar DB, do you want me to:
- **A)** Keep `industry_pulse_*` as the real table, make `growth_radar_*` a view (least churn)
- **B)** Migrate everything to `growth_radar_*` and drop industry_pulse (cleanest long-term, ~1 risky migration)

Default if you don't specify: **A** (safer).

