# DJ Conley Sandbox

Live preview: `/sandbox/djconley` — full public-facing site mirror (12 pages).
Admin: `/sandbox/djconley/admin` (gated).

## Login (demo)
- Allowed emails: `pmichels@djconley.com`, `pat@djconley.com`, `matt@detroitwebagent.com`
- Passcode: `boiler1948`  ← change in `admin/LoginGate.tsx` before pitch day
- Session stored in `localStorage` under `dj_sandbox_session`

## Hosting answer (the question you asked)

You don't need to buy hosting, a VPS, or Cloudflare. Three options:

1. **Lovable subdomain (free, 30 sec)** — once you publish, this project lives at `*.lovable.app`. The sandbox is just a route on it: `https://m2training.lovable.app/sandbox/djconley`.
2. **Subdomain on detroitwebagent.com (recommended for pitch)** — add a `pat` CNAME on detroitwebagent.com → Lovable in **Project Settings → Domains**. Pat's URL becomes `pat.detroitwebagent.com/sandbox/djconley`. Still free, still SSL.
3. **Own domain (only after Pat signs)** — buy `djconleyportal.com` (~$12/yr), point CNAME at Lovable.

Cloudflare is only needed if you want a proxy in front. Lovable already gives you SSL + CDN.

## What's in the sandbox

### Site mirror (12 routes)
Home · About · Industries · Service · Parts · Products · Projects · Rentals · Education · Resources · Careers · Contact

Mirrors djconley.com nav 1:1, slightly sharper (sticky nav, working mobile menu, hover depth on cards, real-feel hero, Plus Jakarta Sans + Playfair "TRUST.").

### Command Center (12 tabs)
Overview · SiteRadar · Missed-Call · Buyer Radar · FieldDesk · TechAlert · Trade Radar · Outreach · Reviews · **Site Widgets** · Reports · Integrations · Team · Settings

### Site Widgets (the 20 gadgets you asked for)
See `src/sandbox/djconley/widgets.ts`. Categorized as:
- **Conversion** (5): Emergency Call Bar, Smart Live Chat, Instant Quote Modal, Case Study PDFs, Energy Savings Calculator, Missed-Call Auto-Text
- **Trust** (4): Trust Badge Strip, Live Google Review Carousel, Interactive Service Map, Owner Video Intro, As-Seen-In Press Strip
- **Live Data** (3): Live Visitor Ticker, Storm/Cold Alert Banner, Public RFP/Bid Feed
- **Engagement** (3): Animated Boiler Room Hero, Equipment Spec Finder, Searchable KB
- **Ops** (2): Tech-On-The-Way Tracker, Annual Tune-Up Reminders
- **Compliance** (1): Code Compliance Countdown

7 are flagged "Recommended" for an industrial boiler shop. Toggle is UI-only for now (writes to local state); next pass wires the toggle to a `tenant_widget_config` table.

## Trojan Horse data (already pre-loaded in the demo)

- SiteRadar visitors: Stellantis Facilities, DMC, Wayne County Schools, Henry Ford Health, Wayne State
- Buyer Radar RFPs: Stellantis $2.4M boiler retrofit, Wayne County $340k/y steam plant, DPS $180k tune-up
- TechAlert signals: DMC posted "Director of Plant Ops", WSU posted "Boiler Operator Lead"
- Trade Radar permits: 1 Ford Place, 300 River Place, 16001 W 9 Mile, 21000 Hoover Rd
- FieldDesk: 7 open jobs (2 emergency at DMC + Stellantis SHAP)
- Outreach: 1,847 industrial-boiler-biased Apollo targets

## Apollo bias (when we wire real enrichment)

In `Settings`:
- `industry = industrial_boiler`
- `apollo_target_titles[]` = Facilities Director · Plant Engineer · Chief Engineer · Maintenance Director · Director of Operations · Property Manager · VP Engineering
- `apollo_keywords` = boiler, steam, pressure vessel, industrial HVAC, combustion, burner
- Budget: $200/mo (Pat is the case study, he gets the lion's share)

When we wire this to real data, the per-tenant config is stored in `field_crm_clients` with `meta.industry='industrial_boiler'`, and `_shared/apollo.ts` reads it to bias every search.

## What's UI-only right now

This is the sandbox shell. Numbers, visitors, RFPs, jobs, signals are demo data hardcoded in the tab components. The real data wires up next, plugging into existing edge functions (`visitor-identify`, `mortgage-radar-scanner`, `trade-radar-scanner`, `techalert-prospect-hunter`, `voicemail-transcription-handler`, etc.).

The **shell, navigation, layout, and visual polish are all real and final** — that's what Pat will see and feel.

## To publish privately for Pat

1. Click **Publish** in the editor.
2. Project Settings → Domains → add `pat.detroitwebagent.com` (CNAME to Lovable).
3. Send Pat: `https://pat.detroitwebagent.com/sandbox/djconley`
4. Tell him: email + passcode `boiler1948` for the command center.

Done.
