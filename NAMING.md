# Radar Product Naming — Single Source of Truth

> Last updated: 2026-04-19. Consult before adding any new copy, route, table, or function for a radar product.

DWA has **3** radar products. Multiple legacy aliases exist in code. **Always normalize to canonical names in user-facing copy.** Code-level aliases are kept to avoid breaking crons, Stripe history, and SEO.

---

## Canonical Names

| Product        | What it does                                | Canonical UI Name |
|----------------|---------------------------------------------|-------------------|
| Talent Radar   | Hiring intelligence (trades + healthcare)   | **Talent Radar**  |
| Demand Radar   | Buyer-intent signals                        | **Demand Radar**  |
| Growth Radar   | Industry expansion / regulatory pulse       | **Growth Radar**  |

---

## Where each name lives

```
USER SEES   → "Talent Radar", "Demand Radar", "Growth Radar"
ROUTES      → /talent-radar/*  (alias /hire-alert, /my-techalert)
              /demand-radar
              /growth-radar    (alias /industry-pulse, /my-industry-pulse)
DB TABLES   → hire_alert_*           = Talent Radar (LEGACY name, do not rename)
              demand_radar_*         = Demand Radar
              industry_pulse_*       = Growth Radar (canonical) ← see migration note
              growth_radar_*         = COMPATIBILITY VIEWS over industry_pulse_*
STRIPE META → hire_alert_subscription   = Talent Radar (legacy key, do NOT change)
              industry_pulse_*          = Demand Radar tier checkout (legacy key)
EDGE FNS    → hire-alert-*           = Talent Radar (do not rename — breaks crons)
              industry-pulse-*       = Growth Radar (do not rename)
              demand-radar-*         = Demand Radar
              growth-radar-*         = Growth Radar (newer functions)
```

---

## Rules

1. **All new user-facing copy uses the canonical name** — page H1s, button labels, email subjects/bodies, SMS bodies, admin tab labels, SEO titles, OG tags.
2. **Code identifiers (variables, functions, files, routes, tables) keep legacy names** — renaming breaks Stripe history, cron jobs, customer email links, and SEO.
3. When you see a legacy alias in code (`TechAlert`, `HireAlert`, `Industry Pulse`), don't touch the identifier — but if there's a string literal nearby that a customer would read, normalize it.
4. **Database**: writers may use either `industry_pulse_*` or `growth_radar_*` table names. Both work. `growth_radar_*` is a compatibility view with INSTEAD OF triggers that route inserts to the canonical `industry_pulse_*` tables. Single source of truth: `industry_pulse_signals` + `industry_pulse_clients`.
5. **Stripe**: `hire_alert_subscription` is the canonical webhook metadata type for Talent Radar billing. Do not change — every existing customer record is keyed to it.

---

## Legacy Alias Map (for grep purposes)

| Legacy alias       | Canonical name | Where it appears                    | Safe to rename?        |
|--------------------|----------------|-------------------------------------|------------------------|
| TechAlert          | Talent Radar   | UI strings, component names         | UI strings: yes. Component names: no. |
| HireAlert          | Talent Radar   | Routes, page filenames, edge fns    | Route alias kept; edge fn names: NO   |
| HireRadar          | Talent Radar   | Older docs/agents                   | Docs only               |
| talent_intelligence| Talent Radar   | Old redirect                        | Redirect kept           |
| Industry Pulse     | Growth Radar   | Page files, tables, edge fns        | UI strings: yes. Table/fn names: no.  |
| industry_pulse     | Growth Radar   | DB tables, edge functions           | NO — canonical DB name  |
| growth_radar       | Growth Radar   | Newer routes, views                 | View, do not promote to table |

---

## When You Add a New Feature

- **New page or marketing copy?** Use the canonical UI name.
- **New edge function for Talent Radar?** Name it `talent-radar-*` (new convention) or extend an existing `hire-alert-*` function. Do not introduce a third naming scheme.
- **New edge function for Growth Radar?** Name it `growth-radar-*` (new convention) or extend an existing `industry-pulse-*` function.
- **New table for radar data?** Use the canonical schema names: `talent_radar_*`, `demand_radar_*`, `growth_radar_*`. Old tables (`hire_alert_*`, `industry_pulse_*`) stay as-is.
- **New Stripe checkout?** Reuse the existing `metadata.type` keys (`hire_alert_subscription`, `industry_pulse_subscription`) so the webhook keeps working.

---

## Why we don't just rename everything

1. **Stripe history**: Every active subscription is keyed by `metadata.type`. Renaming = breaking webhook routing for paying customers.
2. **Cron jobs**: pg_cron schedules call edge functions by URL. Renaming the function breaks the schedule silently.
3. **Email/SMS links** sent to customers reference legacy routes (`/hire-alert?token=...`). Renaming = 404s for everyone who clicks.
4. **SEO**: Existing inbound links and search-engine rankings point to legacy routes.

The cost of partial inconsistency is paid once (this doc). The cost of renaming infrastructure is paid every time a customer's link breaks.
