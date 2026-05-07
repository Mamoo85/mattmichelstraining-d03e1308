# SiteRadar — Premium Overhaul

Three deliverables: (1) fix Enrich, (2) ship a SiteRadar that feels like a $499/mo product not a $49/mo dashboard, (3) nuke every "Matt Michels / M²" leak on DWA pages.

---

## 1. Enrich button — root cause + fix

The button POSTs `{ event_id }`, the edge function requires `{ company_name, city, visitor_event_id }`. Silent 400. Every "Unknown visitor" row is unclickable by design.

**Fix:**
- Backend: accept `{ visitor_event_id }` alone. Look up the event server-side. If `company_name` is null, run **IP → company waterfall**: ipinfo.io → Clearbit Reveal → IPQualityScore → reverse-DNS PTR → ASN org name. Persist result on the event row.
- Frontend: per-row spinner, optimistic update, success/failure toast, animated "Identified ✓" badge replaces the button when company is found.
- Add a "Why no match?" tooltip when ISP/residential IP detected (sets honest expectations).

---

## 2. SiteRadar — 15 premium upgrades

### A. White-glove install ("we handle the tech")

1. **Auto-Install Concierge.** Customer enters their domain. We:
   - Detect platform (WordPress / Shopify / Wix / Squarespace / Webflow / Duda / custom) via Firecrawl + sniffed headers.
   - WordPress → install via REST API + Application Password (1 paste, then auto-injects via `wp_footer` hook in a tiny must-use plugin we deploy).
   - Shopify → OAuth app embed → automatic theme.liquid injection.
   - Webflow → API token, push custom code via Sites API.
   - Wix / Squarespace / Duda → can't auto-inject; instead **email their webmaster** (form: webmaster email + your name) with a 90-second screen-recording walkthrough we pre-render with their brand color, plus the snippet pre-filled. Status flips to "🟡 Awaiting webmaster" with a follow-up nudge in 24h.
   - GTM detected → push as a GTM tag automatically.
   - Status pill in dashboard: **⚪ Not Installed → 🟡 Pending → 🟢 Live** (auto-flips on first event).

2. **Verify-on-paste live test.** Big "Test my install" button — opens their site in headless Browserless, fires the snippet, shows ✅ "Snippet detected, fired in 240ms" or ❌ "Not found on /pricing — here's why."

3. **DNS health badge.** Side-check: CNAME, TLS, robots.txt — flag if their site blocks our snippet (CSP, ad-blockers, Cloudflare bot protection). Saves the "why isn't it working" support ticket.

### B. Make the data 10× more valuable

4. **Visit-Intent Score (0–100).** Pages/session × dwell × pricing-page-hit × return-visitor × ICP-match × company-size. Top of feed pulses. Replaces the meaningless gray dot.

5. **Hot Visitor Hero card.** Above the fold: most recent identified visitor → logo, company, employee count, industry, pages visited, time on site, and a **1-tap action row**: 📞 Call · ✉️ Email · 💬 LinkedIn · ➕ Add to outreach pipeline · 🤖 Draft cold email.

6. **AI Cold Email Drafter.** "Draft outreach" button on any identified row → Opus-generated personalized opener referencing the *exact pages they visited* ("Saw you spent 4 minutes on /pricing/enterprise — want to skip the form?"). Pre-fills mailto, copies to clipboard, or pushes to outreach pipeline.

7. **Buying-Signal Triggers.** Auto-flag the visit pattern that matters:
   - Hit `/pricing` AND `/contact` → "🔥 Closing-window"
   - 3+ visits in 7 days → "🌡️ Returning warm"
   - Came from competitor comparison search → "⚔️ Bake-off"
   - Visited from a corporate IP after-hours → "🌙 Decision-maker research mode"

8. **Real-time push alerts.** Slack / Teams / Discord webhook + email + SMS the moment an ICP visitor arrives. "🔥 Acme Industries (250 emp, manufacturing) just hit /pricing." Webhook config UI in dashboard. (Reuses existing `crm-webhook.ts`.)

9. **Daily Intel Brief.** New cron `siteradar-daily-digest` 8am ET — top 5 identified companies, ICP matches, intent score deltas vs yesterday, biggest mover. Branded HTML email. Toggle in dashboard.

10. **Weekly Executive Report (PDF).** Browserless-rendered 1-page PDF: total visitors, identified companies, ICP hit rate, top intent visitors, recommended next actions. Emailed Mondays. Mat-finishable artifact a customer can forward to their boss = retention gold.

### C. UX polish — make it feel premium

11. **Full Tailwind/shadcn rebuild.** Kill the inline `style={{...}}` soup. Glass-morphism cards, framer-motion on new visitor rows, sticky action bar, sparklines on stat cards, dark gradient hero, semantic tokens (`bg-card`, `text-foreground`).

12. **Bulk Enrich + Smart Queue.** Checkbox each row, "Enrich selected" runs through batch with progress. Auto-enriches on a queue when score ≥ 50.

13. **Saved Views & Smart Filters.** "ICP only", "Pricing-page visitors", "Returning ≥ 3x", "Industry: Manufacturing". Each saved view gets its own daily digest toggle.

14. **Company Profile Slide-Over (upgraded).** Logo (Clearbit Logo API), employees, founded year, tech stack (BuiltWith API or Wappalyzer), funding (Crunchbase free tier), LinkedIn link, 5 likely decision-makers (Apollo people search), one-click "Push to HubSpot/Pipedrive."

15. **Onboarding 2.0 + Welcome Sequence.** Replace the 4-checklist with a glass progress hero: "You're 50% to your first identified visitor." Day 0 / 1 / 3 / 7 onboarding emails: install nudge → first-data celebration → first-identified-visitor walkthrough → "here's what to do with your data" playbook.

### Bonus retention plays

- "First Identified Company" celebration animation + "share with team" link.
- NPS micro-prompt at day 14 (existing `nps-survey-sender`).
- **Founder Mode**: in dashboard footer, "Matt's mobile: text WIN to 313-992-1219 when you close one we sourced." Builds the testimonial flywheel.

---

## 3. Brand cleanup — every M²/Matt Michels leak

Audit and kill:

1. **`index.html` line 159** — extra defense: don't swap `apple-mobile-web-app-title` to "M² Training" if path starts with any DWA prefix, including `/my-`, `/dwa-admin`, `/site-radar`, `/contractor-marketplace`, etc. (gate already exists but tighten + test).
2. **`SEOHead.tsx` line 73** — short-circuit by hostname first: `detroitwebagent.com` → always DWA, regardless of path. Belt + suspenders for the path list.
3. **Favicon** — confirm `/favicon.png` is DWA on DWA paths. Add a JS favicon swap inside the existing manifest selector block: DWA paths get `/favicon-dwa.png`, M² paths get `/favicon-m2.png`. Ship a generated DWA favicon.
4. **Browser tab title flash** — the static `<title>Detroit Web Agency…</title>` is correct, but verify SiteRadar's `<Helmet>` runs before any M² helmet on subsequent navigation. Add a defensive `document.title` set on mount of every `My*` page.
5. **Repo grep sweep** — `Matt Michels`, `M² Training`, `M2 Training`, `mattmichelstraining`, `mattmichels` across all DWA components/pages/email templates. Anything in a DWA-only context → "Detroit Web Agency."
6. **Email footers** — verify `dwa-email.ts` template never imports M² assets. Verify SiteRadar welcome/digest emails route through `dwaEmail()` not `m2Email()`.
7. **PWA manifests** — confirm `manifest-dwa-client.webmanifest` has DWA name + icons (not M²).
8. **Apollo tracker comment** in `index.html` line 168 says "M² SiteRadar" — change to "DWA SiteRadar."

---

## Files touched

```text
src/pages/MySiteRadar.tsx                              # full rebuild
src/components/site-radar/HotVisitorHero.tsx           # NEW
src/components/site-radar/IntentScoreBadge.tsx         # NEW
src/components/site-radar/InstallConcierge.tsx         # NEW
src/components/site-radar/SignalTriggerChip.tsx        # NEW
src/components/site-radar/CompanyProfileSheet.tsx      # NEW (upgraded slide-over)
src/components/site-radar/AlertWebhookConfig.tsx       # NEW
src/components/site-radar/SavedViewsBar.tsx            # NEW
src/pages/admin/SiteRadarInstallTool.tsx               # NEW (admin oversight)
supabase/functions/enrich-visitor/index.ts             # accept event_id-only, IP waterfall
supabase/functions/siteradar-auto-install/index.ts     # NEW (WP/Shopify/Webflow APIs)
supabase/functions/siteradar-verify-snippet/index.ts   # NEW (Browserless live test)
supabase/functions/siteradar-daily-digest/index.ts     # NEW cron 8am ET
supabase/functions/siteradar-weekly-pdf/index.ts       # NEW cron Mon 7am ET (Browserless)
supabase/functions/siteradar-intent-score/index.ts     # NEW (compute on insert)
supabase/functions/siteradar-onboarding-drip/index.ts  # NEW (D0/D1/D3/D7)
supabase/functions/siteradar-ai-opener/index.ts        # NEW (Opus draft)
supabase/migrations/<ts>_siteradar_premium.sql         # intent_score, install_status, install_platform, alert_webhooks, saved_views, signal_triggers
src/components/layout/SEOHead.tsx                      # hostname short-circuit
index.html                                             # favicon swap + tightened M² gate + Apollo comment
public/favicon-dwa.png                                 # NEW
public/favicon-m2.png                                  # NEW
```

---

## Order of operations (so we ship value fast)

**Wave 1 (today, ~1 hr):** Enrich fix · brand sweep · favicon swap. Quick wins, customers see immediately.

**Wave 2 (next, ~3 hr):** SiteRadar rebuild — Hot Visitor Hero, Intent Score, Bulk Enrich, Signal Triggers, Tailwind polish, upgraded Company slide-over.

**Wave 3 (after Wave 2 verified):** Install Concierge (WP + Shopify + Webflow auto-install + webmaster email flow), Verify-on-paste, Saved Views, Webhook alerts.

**Wave 4 (retention):** Daily digest, Weekly PDF, AI Opener, Onboarding drip, Founder Mode footer.

Approve and I'll start Wave 1 immediately.
