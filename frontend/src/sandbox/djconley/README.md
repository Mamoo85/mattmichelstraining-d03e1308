# D.J. Conley — Sandbox & Hosting Trial

Our first website hosting client. This folder is the **deployed** D.J. Conley experience
(part of the Vercel `frontend/` build).

- **Public site (exact clone of djconley.com):** `/sandbox/djconley`, and at the root of any
  D.J. Conley domain (`sandbox.djconley.com`, `djconley.com`, `www.djconley.com`,
  `pat.detroitwebagent.com`) — see `frontend/src/lib/domainConfig.ts`.
- **Command Center (admin):** `/sandbox/djconley/admin` — gated by Supabase magic-link
  (`admin/LoginGate.tsx`). Allowlist: `pmichels@djconley.com`, `pat@djconley.com`,
  `matt@detroitwebagent.com`. Offline-demo fallback access code: `boiler1948`.

## Hosting (Vercel — corrected)

Production is **Vercel** (`vercel.json` builds `frontend/`, output `frontend/dist`).
The site is multi-tenant by hostname; adding a D.J. Conley domain = (1) add it to
`DJ_CONLEY_DOMAINS` in `domainConfig.ts`, (2) add it as a domain in the Vercel project,
(3) client points DNS at Vercel.

**Trial (recommended, zero risk):** client adds ONE record —
`CNAME  sandbox → cname.vercel-dns.com`. Their live site + email are untouched; Vercel
auto-issues SSL. Send Pat `https://sandbox.djconley.com`.

**Go-live (after they sign):** point apex `djconley.com → A 76.76.21.21` and
`www → CNAME cname.vercel-dns.com`. **Never touch MX/SPF/DKIM/DMARC** — that's their email.

The full step-by-step playbook lives in the admin panel:
**DWA Admin → Customers & Revenue → 🚀 Client Onboarding**
(`frontend/src/components/dwa-admin/ClientOnboardingGuide.tsx`).

## Assets

Real djconley.com media (logo, favicon, 107 product/site images) lives in
`frontend/public/demo-djconley-current/`. Content text is in `content.ts`
(auto-scraped from djconley.com).

## Command Center data

Tabs (`admin/tabs.tsx`, `admin/Overview.tsx`) currently render representative sample
data behind a visible "Trial preview" banner. Real per-tenant wiring (SiteRadar →
`crm_visitor_events`, Missed-Call → `missed_call_captures`, FieldDesk →
`field_service_jobs`, Trade Radar → `trade_radar_*`, TechAlert → `hire_alert_*`,
Outreach → `outreach_leads`, Reviews) connects once the D.J. Conley tenant is
provisioned on the primary Supabase project. Net-new sources still to build:
MITN.info boiler-RFP scanner (Buyer Radar) + industrial-boiler Apollo bias.
