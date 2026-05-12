## Goal

Give Matt one place inside `/dwa-admin` to (a) see every radar he sells exactly the way a paying customer sees it, and (b) preview/customize the admin panel that will ship inside every website-build client (starting with DJ Conley / Pat).

## What already exists

**Customer-facing radar portals** (23 pages, all live):
`MyRoofingRadar`, `MyHVACRadar`, `MyPlumbingRadar`, `MyElectricalRadar`, `MyPestControlRadar`, `MyGuttersRadar`, `MyExteriorRadar`, `MyTreeRadar`, `MyRestorationRadar`, `MyDemoJunkRadar`, `MyFoundationRadar`, `MyPaintingRadar`, `MyMortgageRadar`, `MyTechAlert`, `MySiteRadar`, `MyMissedCall`, `MyFieldDesk`, `MyDemandRadar`, `MyBuyerRadar`, `MyContractorLeads`, `MyDeadLeadReactivation`, `MyIndustryPulse`, `MyCounselSearch`.

**DJ Conley sandbox** (`/sandbox/djconley/*`): public marketing site mirror (Home, About, Industries, Service, Parts, Products, Projects, Rentals, Education, Resources, Careers, Contact + 6 boiler product pages, Blog) **plus** an Admin Command Center (`AdminShell` + 12 tabs: SiteRadar, Missed-Call, Buyer Radar, FieldDesk, TechAlert, Trade Radar, Outreach, Reviews, Widgets, Reports, Integrations, Team, Settings).

**DWA Admin** (`/dwa-admin`): already has `DJConleyCommandPanel` lazy-loaded and a 5-group sidebar (Today / Customers / Outreach / Products / Ops).

**What's missing** is the consolidation Matt is asking for: there's no single "view everything as a customer would" surface, and no admin-side preview of the DJ Conley client admin.

---

## Plan

### 1. Enroll Matt in every product (migration)

New migration `supabase/migrations/<ts>_matt_full_enrollment.sql` that upserts a `matt@detroitwebagent.com` row into every client table that doesn't already have one, using SE-Michigan ZIP coverage + `status='active'`:
`field_crm_clients` (FieldDesk + SiteRadar visitor script), `hire_alert_clients` (TechAlert), `missed_call_clients`, `mortgage_radar_clients`, `contractor_clients`, `dead_lead_campaigns`, `industry_pulse_clients` (Buyer + Demand + Growth), plus all 11 `trade_radar_clients` rows. Idempotent (`ON CONFLICT DO UPDATE`). Phase 44 already enrolled some of these; this migration fills the gaps and standardizes Matt's tokens so the customer pages render real data.

### 2. New tab — "My Command Center" (customer view)

- Add sidebar group `👤 My Stuff` with item `my-command-center` at the top of `DWAAdmin.tsx` GROUPS.
- New component `src/components/dwa-admin/MyCommandCenter.tsx`:
  - Top KPI strip (active subscriptions count, total leads this week across all radars, today's signal count, MRR-equivalent if Matt were paying).
  - Sub-nav of pills, one per product Matt is enrolled in (Trade Radar 11 verticals collapsed into one pill with a vertical sub-picker, then Mortgage / Talent / Site / Missed-Call / FieldDesk / Demand / Buyer / Contractor / Dead Lead / Industry Pulse / Counsel).
  - Body renders the matching `My*` page component **inline** (not iframed) by importing them as lazy components. They already query Supabase by `auth.uid()` / token, so once Matt is enrolled they "just work."
  - "Open in new tab" link on each so Matt can pop the customer portal full-screen for screenshots.

### 3. New tab — "Client Admin Sandbox" (DJ Conley preview)

- Sidebar group `🧪 Client Sandbox` with items `dj-conley-site` and `dj-conley-admin`.
- Component `src/components/dwa-admin/ClientSandboxFrame.tsx`: an iframe wrapper that loads `/sandbox/djconley/` or `/sandbox/djconley/admin` with a top toolbar:
  - Quick-jump dropdown of all 12 admin tabs.
  - Device-width toggle (desktop / tablet / mobile).
  - "Open standalone" button.
  - "Customize" panel (right rail) for the things Matt will most want to tweak: brand color, logo URL, owner name, owner email, included radar pills. Writes to a `sandbox_tenant_config` table (new) so changes survive reload and we can later promote them into a real client provisioning record.

### 4. DJ Conley parity audit

Deliverable: `knowledge/djconley-parity-audit.md` listing every page on the live djconley.com vs what's in `src/sandbox/djconley/pages/` with status (✅ exact / 🟡 minor delta / ❌ missing) and the "very minor enhancement" deltas Matt wants noted per page. The 18 routes already in `index.tsx` cover the main IA; this step verifies content fidelity (copy, hero photos, product specs, contact info) and flags anything to repaint before the Pat demo.

### 5. Replace placeholder data in DJ Conley admin tabs

The 12 tabs in `src/sandbox/djconley/admin/tabs.tsx` are all hardcoded `TabPlaceholder` demos. For the Pat demo we'll wire the 4 most impactful ones (SiteRadar, Buyer Radar, TechAlert, Reviews) to live Supabase queries scoped by a sandbox `client_id`, so Pat sees actual data in those panels. The other 8 stay as polished mockups (clearly labeled "Sample Data" badge) — same level Pat sees in proposals today.

---

## Technical Details

- All `My*` pages use `lazyRetry()` and read from Supabase via `useAuth()` or token query param. Inline mounting inside `MyCommandCenter` works because they're already self-contained route components.
- The iframe approach for the sandbox preview avoids React-Router collisions with the parent `/dwa-admin` route tree.
- New table `sandbox_tenant_config` (single row keyed by `tenant_slug='djconley'`): `brand_color`, `logo_url`, `owner_name`, `owner_email`, `enabled_radars text[]`, `updated_at`. RLS: admin-only.
- No edge-function changes required for the customer view — everything Matt needs already runs daily (scanners, digests). Migration #1 just makes sure his rows exist so the dashboards render data instead of empty states.
- Keep the DWA Admin sidebar additions at the top of `GROUPS` so Matt sees them first on load.

## Out of scope (call out before building)

- Building real auth/seat management for the DJ Conley client admin (it's a sandbox login gate today; productionizing multi-tenant client logins is a separate project).
- Replacing all 12 DJ Conley admin tabs with live data — only wiring the 4 demo-critical ones for Pat.
- Any changes to existing customer `My*` pages themselves.

---

## Open questions before I build

1. For the "My Command Center" view, do you want the 11 Trade Radar verticals shown as **one combined feed** (all leads from all 11 verticals merged + filterable), or as **11 separate sub-tabs** like a customer enrolled in all 11 would see? Like a customer would see. 
2. The DJ Conley sandbox admin currently uses fake demo data on 12 tabs. Should I (a) wire 4 tabs to real data + label the rest "Sample," or (b) wire all 12 to real data scoped to a `djconley` sandbox tenant (longer build)? Real data.
3. Confirm: the "exact replica of his current website" means content-parity with what's at djconley.com today (I'll pull and diff) — not a redesign, right? Right, don't we already have this? 