# DJ Conley Sandbox — Plan

Goal: stand up a private "shadow" version of djconley.com that looks like Pat's site (slightly sharper) and bolt every DWA product onto it for free, so when Pat sees it the conversation is "we're the backend brain for your existing website" — not "switch your site."

---

## 1. Hosting — How a sandbox like this actually goes live

You don't need to buy hosting, a server, or Cloudflare. Here's the truth on each option, in order of recommendation:

**Option A — Lovable subdomain (recommended, $0, ~30 sec)**

- Every Lovable project gets a free `*.lovable.app` URL when published.
- We publish at something like `djconley-sandbox.lovable.app` or `pat.detroitwebagent.com`.
- SSL, CDN, and DNS all handled by Lovable. No servers, no Cloudflare needed.
- We can password-gate it (publish visibility = private) so only Pat sees it until pitch day.

**Option B — Subdomain on detroitwebagent.com (recommended for the pitch, $0)**

- Use `pat.detroitwebagent.com` or `sandbox.detroitwebagent.com`.
- One DNS record on detroitwebagent.com → Lovable. Same hosting, just a sharper-looking URL when Pat opens the link.
- Still free, still SSL, still our infra.

**Option C — Buy djconleyportal.com or similar (~$12/yr, optional polish)**

- Only worth it if Pat is signed. For the demo, Option B is enough.

**Option D — Self-host on a VPS / Cloudflare Pages**

- Not needed. Adds cost, ops, and zero value over Lovable hosting. Skip.

**Recommendation:** publish to `pat.detroitwebagent.com`, set visibility to private (or share-preview link, 7-day expiry) until you're ready to pitch.

---

## 2. The Frontend — "His exact website, slightly sharper"

DJ Conley's real site (djconley.com) is a WordPress + Visual Composer build with this nav:

```text
Home · About · Industries · Service · Parts · Products · Projects ·
Rentals · Education · Resources · Careers · Blog · Contact
```

Brand: navy + teal `#27CCC0` accent + red `#c12a3b`, white background. Tagline "TRUST. A name you can trust." Boiler/pressure vessel/combustion focus, Detroit/Michigan territory.

We already have 4 demo iterations in the repo (`/demo-djconley-v2..v6/`). v6 is closest. The plan:

**Build `/sandbox/djconley` as a true site clone (not a one-pager):**

- Real multi-page React routes mirroring djconley.com nav 1:1
- Same copy, same service categories, same brand palette — pulled directly from djconley.com
- "Slightly sharper" upgrades (no jarring redesign):
  - Cleaner typography pairing (Inter + a serif accent for "TRUST.")
  - Faster page loads (lazy-loaded images, modern image formats)
  - Sticky header that doesn't jump
  - Mobile nav that actually works (theirs is clunky)
  - Subtle scroll-reveal animations
  - Real-feel hero with motion (not a static slideshow)
  - Service cards with hover depth instead of flat tiles
- Every page keeps Pat's logo, his territory map PDF, his line cards, his contact info
- Footer line: "Powered by Detroit Web Agency" — small, but it plants the seed

This is the Trojan Horse: it looks like *his* site, just better. The pitch becomes "we already rebuilt this — and here's what it can DO."

---

## 3. The Admin Panel — Pat's "Boiler Room Command Center"

Goal: when Pat logs in, he sees a control room that feels as serious as Supabase / Apollo / GitHub. Dark sidebar, dense info, real data, real value.

**Layout (left sidebar, GitHub/Supabase style):**

```text
🔥 DJ Conley · Command Center
─────────────────────────────────
  📊  Overview (KPIs, today's pulse)
  🎯  SiteRadar       ← who's on djconley.com right now
  📞  Missed-Call     ← every missed call + voicemail + auto-text
  🏭  Buyer Radar     ← MITN.info RFPs, gov bid signals
  🔧  FieldDesk       ← jobs, techs, schedule, invoices
  💰  TechAlert       ← competitor hires, talent moves
  🏗️  Trade Radar     ← permits, building signals (commercial boiler angle)
  📬  Outreach        ← cold email + fax campaigns to industrial buyers
  ⭐  Reviews         ← Google review monitor
  📈  Reports         ← weekly digest, ROI, attribution
─────────────────────────────────
  🔌  Integrations
  ⚙️  Settings
  👥  Team
```

**Top bar:** search-everything (Apollo style ⌘K), notifications bell, Pat's avatar + org switcher.

**Main panel patterns (per tab):**

- Header strip with KPI cards (live counters)
- Filter row (date range, status, source)
- Dense data table with row drawer for detail (Supabase-table feel)
- Right-side context panel for selected record (GitHub PR-detail feel)
- Activity feed at bottom of overview (Apollo timeline feel)

**What gets pre-loaded for Pat (the Trojan Horse — all FREE):**

1. **SiteRadar tracking script** already installed on `djconley.com` mirror — first login shows real-feeling visitor data (Stellantis Facilities, DMC, Wayne County Schools — already in `djconley.json` demo config).
2. **Missed-Call** wired to (313) 590-4404 forwarding, with voicemail transcription + auto-text.
3. **Buyer Radar** pre-seeded with MITN.info + SAM.gov + Michigan boiler/pressure-vessel RFP signals from the last 90 days.
4. **Trade Radar** filtered to commercial boiler / pressure vessel / industrial HVAC permits in Wayne / Oakland / Macomb / Washtenaw.
5. **TechAlert** watching Stellantis, DMC, Henry Ford Health, Beaumont, Wayne State, Detroit Public Schools, big Detroit GCs for boiler/mechanical hiring signals.
6. **Apollo enrichment budget biased to industrial buyers** — facilities directors, plant engineers, hospital chief engineers, school district maintenance directors, property management at industrial parks. (This is where you said most Apollo credits should go — locked in via a per-tenant Apollo budget config tied to industry='industrial_boiler'.)
7. **FieldDesk** seeded with 2 weeks of mock jobs styled like real boiler service tickets (so it doesn't feel empty on day 1).

The goal: Pat logs in and within 30 seconds says "wait — this is already running on my company?"

---

## 4. Technical sections (for the build phase)

**Routes to add:**

- `/sandbox/djconley` — public-facing site mirror (12 pages mapping djconley.com nav)
- `/sandbox/djconley/admin/*` — the command center (gated by an owner session — same `owner_session` pattern already in `OwnerDashboard.tsx`)
- Login at `/sandbox/djconley/admin/login` — magic-link to `pmichels@djconley.com`

**Reuse of existing code:**

- Owner auth pattern: `src/pages/OwnerDashboard.tsx` (already supports magic-link + command-center tiles per owner email)
- Demo data: `src/data/demoConfigs/djconley.json` (already has visitors, stats, competitor pricing)
- Brand palette already in `/demo-djconley-v6/`
- Existing admin component library under `src/components/admin/` (OutreachObservability, OutreachQueueMonitor, EnrichmentDLQPanel, etc.) — wrap these in DJ-branded shell, don't rebuild
- SiteRadar visitor script: existing `visitor-identify` edge function

**Industry-bias for Apollo enrichment (the "spend most credits on his type of business" rule):**

- New row in `field_crm_clients` for djconley.com with `industry='industrial_boiler'`
- Add `apollo_target_titles[]` column (or use existing meta JSON): `["Facilities Director","Plant Engineer","Chief Engineer","Maintenance Director","Director of Operations","Property Manager","VP Engineering"]`
- Modify `_shared/apollo.ts` callers to read this list when the request originates from a tenant flagged industrial_boiler — bias `person_titles` and `q_keywords=boiler OR steam OR pressure vessel OR HVAC` in the search

**Per-tenant Apollo budget gate:**

- Use existing `_shared/enrichment-budget.ts` to cap monthly Apollo spend per tenant
- Set DJ Conley's cap high (e.g., $200/mo of Apollo credits) since he's the trojan horse case study

**Hosting / publish:**

- Set publish visibility = private OR generate share-preview link (7 days) until pitch day
- DNS: add `pat` CNAME on detroitwebagent.com → Lovable

---

## 5. Build order (when you say go)

1. Stand up the 12-page DJ Conley site mirror at `/sandbox/djconley`
2. Build the admin shell (sidebar + top bar + Overview tab)
3. Wire each existing product (SiteRadar, Missed-Call, Buyer Radar, FieldDesk, TechAlert, Trade Radar, Outreach, Reviews) into its tab
4. Seed the demo data (Stellantis/DMC/Wayne County visitors, Michigan boiler RFPs, Detroit boiler permits, hospital hiring signals)
5. Bias Apollo enrichment to industrial-boiler titles for this tenant
6. Magic-link auth for `pmichels@djconley.com`
7. Publish privately to `pat.detroitwebagent.com`

---

## 6. Open questions before I build

1. **URL:** `pat.detroitwebagent.com` — good `sandbox.detroitwebagent.com`, `command.detroitwebagent.com`)?
2. **Visibility before pitch:** private (login required) or public-but-unlinked (anyone with URL can see)? Private,  super easy login
3. **"Slightly sharper" — how far?** Pure 1:1 clone with polish only (recommended), or do you want one signature visual upgrade that makes Pat say "whoa" (e.g., animated boiler-room hero, live visitor ticker on the homepage)? Just shaper but we need a tab for "website gadgets" and things like animated boiler room hero should be am option or live vister ticker. Think of 20 useful widgets or gadgets someone like pat would like. 
4. **Do you want the admin panel to live at** `/sandbox/djconley/admin` **(one project) or get its own subdomain (**`pat-admin.detroitwebagent.com`**)?** Same code either way — just a routing choice. It needs its own subdomain. Cant have the m2 training problem happen to any other website 