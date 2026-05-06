# Premium Email Overhaul + Trial-Link Click Test

## What Claude is fixing (skipped here — do not touch)
1. `supabase/functions/prospect-local-businesses/index.ts` — visual redesign, demo image, add-on box, demo CTA anchor
2. `supabase/functions/web-design-drip/index.ts` — D4/D8 add‑on copy
3. `MEMORY.md` at repo root — "websites are Trojan horses" doctrine

## My job (this loop): audit + upgrade every other outbound email & verify every trial link

The codebase has **~50+ outbound email functions** that send to prospects/clients (not internal admin digests). They fall into 6 buckets. I'll fix all 6 bucket‑level issues with a shared template, then sweep individual senders.

---

## Phase 1 — Build a single premium email shell (shared)

Create `supabase/functions/_shared/dwa-premium-email.ts` exporting `buildPremiumEmailHtml({ preheader, heroBadge, headline, paragraphs[], statCard?, addOnBox?, ctaUrl, ctaText, signoffLine?, footerNote? })`.

Design pillars (matches the screenshot Matt approved + Claude's notes):
- **560px max-width**, white card on `#0a1628` outer wrap, DWA teal `#00d4ff` accents
- **Preheader** (hidden inbox preview line)
- **Hero badge** (small teal pill — e.g. "DETROIT WEB AGENCY" or "TRADE RADAR · ROOFING")
- **Punchy headline** (24px bold, no walls of text)
- **Paragraphs as separate `<p>` blocks** — never `\n` to `<br>` runs. Max 2 sentences each.
- **Optional stat card** — for products with metrics (e.g. "3–4 missed bookings/mo", "$47k missed revenue")
- **Optional add‑on box** — teal-bordered, 3 bullets, used on every web-design + every Radar email per Matt's "always stress add-ons" rule
- **Pill CTA button** — teal, white text, arrow, big tap target; the URL is built ONLY through `buildOfferUrl()` from `_shared/offer-url.ts` so UTM + product slug are always correct
- **Signature block** — Matt's headshot, name, brand, phone (313) 992-1219
- **Footer** — address line + one-click unsubscribe (already required by Resend)

All future senders import this — no more bespoke HTML in 50 files.

## Phase 2 — Universal trial-link integrity (the click test)

Build `supabase/functions/_shared/cta-registry.ts`: a single source of truth mapping each cold/drip email → its correct CTA destination. Two flavors:

| Audience | CTA target |
|---|---|
| Web-design pitch (healthcare/legal/dental/restaurant/manufacturing/real-estate) | `https://detroitwebagent.com<industry-page>#demo` (no trial — web design has no trial; matches `TRIAL_ELIGIBLE_PRODUCTS`) |
| Trade Radar (11 verticals) | `buildOfferUrl("trade_radar", …)` → `/start-trial?product=trade_radar_<vertical>` |
| Mortgage Radar | `buildOfferUrl("mortgage_radar", …)` |
| TechAlert / FieldDesk / SiteRadar / Missed-Call / AI Phone / Bundle | `buildOfferUrl(<key>, …)` |
| Contractor Leads, Dead Lead | landing pages (no trial per offers.ts) |

Then run `e2e-link-auditor` (already exists at `supabase/functions/e2e-link-auditor/`) against every sender's CTA. **Click test = HTTP HEAD/GET each URL and assert 200 + that the React route resolves to the right page component.** Output a green/red matrix to `/mnt/documents/email-link-audit.md`.

## Phase 3 — Sender-by-sender upgrades

I'll touch only senders that go to **prospects/clients**, not internal admin SMS/digests. Grouped by priority:

**A. Highest-volume cold senders (full rewrite to premium shell):**
- `prospect-local-businesses` (Claude — skip)
- `web-design-drip` (Claude — skip)
- `multi-service-drip` — currently uses `dashboardPreviewHtml`; needs add-on box + correct per-industry CTA
- `dwa-product-blast` — 4 product variants; needs premium shell + verified trial URLs
- `contractor-prospector` — already uses plainCta/trialCta; needs shell upgrade + add-on box
- `siteradar-cold-blast`, `fielddesk-cold-blast` — premium shell + `buildOfferUrl`
- `techalert-outreach`, `techalert-followup-drip` — premium shell; TechAlert is **non-trial**, so plain CTA to `/talent-radar`
- `marketplace-outreach-blast` — premium shell + correct lead URL
- `dossier-cold-outreach`, `dossier-cold-outreach-bulk` — premium shell

**B. Per-product transactional/drips (audit copy, force shell + correct CTA):**
- `mortgage-radar-am-digest`, `mortgage-radar-weekly-digest`, `mortgage-radar-outreach`
- `trade-radar-am-digest`, `trade-radar-weekly-digest`, `trade-radar-outreach`, `trade-radar-urgency-alert`, `trade-radar-referral`
- `industry-pulse-client-drip`, `industry-pulse-digest`
- `hire-alert-client-drip`, `hire-alert-founder-report`, `techalert-weekly-digest`, `techalert-weekly-roi`, `techalert-winback`, `techalert-tease-conley`
- `field-service-daily-summary`, `field-crm-monthly-proof`
- `missed-call-monthly-proof`, `site-radar-monthly-proof`, `site-radar-weekly-digest`
- `client-roi-digest`, `monthly-proof-email`, `monthly-upgrade-recap-sender`
- `trial-drip-runner`, `trial-day6-email` — verify magic-link / start-trial URLs
- `dead-lead-drip`, `dead-lead-outreach-drip`
- `cross-sell-drip`, `pipeline-batch-drip`, `pipeline-drip-send`, `prospect-followup-runner`
- `nps-survey-sender`, `referral-ask-sender`, `quote-followup-sender`
- `welcome-drip-sender`, `anniversary-notice-sender`, `monthly-proof-email`
- `auto-onboard` welcome emails (per product)
- `stripe-webhook` welcome emails — **8 product variants, each must link to correct `/my-*` portal**

**C. Skip (internal-only, no customer impact):** `admin-*`, `weekly-admin-digest`, `morning-digest`, `email-deliverability-check`, `nps-survey-sender` admin, `outreach-backlog-watchdog`.

## Phase 4 — Click-test execution

1. Spin up `npm run dev` style preview is not needed — the published URLs are live at `detroitwebagent.com`.
2. Script: `code--exec` curls each unique CTA from the registry. For `/start-trial?product=*`, additionally check that React `StartTrial.tsx` `PRODUCTS` map contains the slug (compile-time check via `rg`).
3. Render every premium email through `preview-transactional-email` to a static HTML file in `/mnt/documents/email-previews/` and visually inspect each (convert to PNG screenshot via headless tool, attach to audit report).
4. Re-audit pass: re-read 10 random rendered emails and verify (a) preheader present (b) ≤2 sentences per `<p>` (c) add-on box present where applicable (d) CTA URL matches registry (e) signature has correct DWA phone (313) 992-1219.

## Phase 5 — Deliverable

- One audit report at `/mnt/documents/email-audit-report.md`: per-sender row showing **Before / After / CTA URL / Click-test result / Add-on box ✓ / Premium shell ✓**.
- Sample rendered HTML previews for the top 12 emails.
- All edits committed; `supabase--deploy_edge_functions` invoked for every modified function.

## Risk / scope notes

- ~40+ edge functions will be edited. I will batch by bucket and deploy per bucket to keep blast radius small.
- I will NOT touch the 3 files Claude owns.
- I will NOT change any pricing, trial length, or coupon logic — only copy + visuals + CTA URL plumbing through `buildOfferUrl`.
- If any product is missing from `offers.ts` / `StartTrial.tsx PRODUCTS`, I'll flag it in the audit report rather than silently invent a URL.

Approve and I'll execute Phases 1→5 in order.
