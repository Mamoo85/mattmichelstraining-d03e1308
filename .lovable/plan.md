# DJ Conley Follow-Up — Master Plan v3 (locked)

> Incorporates your honest notes: forever-pricing is the moat, fusion is the wedge, person-level ID gets honest framing, demo colors come FIRST, follow-up email ships tonight.

---

## §0. Pricing (locked to your call)

**New product: "DWA Managed Website + Owner Dashboard"**

| Option | Price | Includes |
|---|---|---|
| **All-in monthly** | **$499/mo** | Website + Owner Dashboard + SiteRadar Pro + Predictive Sales + Missed-Call/Review Texts + Email Blast Engine. Zero upfront. |
| **Build + Maintain** | **$499 one-time + $199/mo** | Same product, lower recurring. |

**Optional add-on:** RB2B person-level visitor ID — **+$300/mo at cost** (transparent pass-through).

### The "Forever Pricing" promise (the moat)
> "Your price never goes up. Every upgrade we ship — forever — is free. We push improvements every single day. You're not buying a snapshot, you're buying the cutting edge for life."

---

## §1. STEP ZERO — Recolor DJ Conley demos (do FIRST, before anything else)

Their explicit meeting objection. Nothing else gets built until this is done.

- **Files:** `/public/demo-djconley-1/*`, `/public/demo-djconley-2/*` (or wherever the demos live — verify path), `src/data/demoConfigs/djconley.json`
- **Palette:** Navy `#1B4F8A`, Orange `#E07B39`, cream `#FFF5E6`, white surfaces. Kill all teal/cyan (`#00d4ff`).
- **Logo:** Use `/public/demo-logos/djc-wordmark.svg` (already on-brand) in header.
- **Update `djconley.json`:** `accentColor: "#1B4F8A"`, alert color `#E07B39`.
- **Verify:** screenshot both demo routes after recolor — zero teal pixels.

---

## §2. STEP ONE — 24-hour follow-up email to Pat (ship TONIGHT)

Pat needs something in his inbox within 24 hours of the meeting or momentum dies.

**One-page proposal email** sent from `matt@detroitwebagent.com` to Pat. Contents:

1. Thanks + recap in 2 sentences ("Loved meeting yesterday. Here's exactly what I'd build for D.J. Conley.")
2. **The two pricing options** clearly laid out (§0 table).
3. **The Forever Pricing promise** in a callout box.
4. **What's included** — 6 bullet points (Website, Owner Dashboard, SiteRadar Pro, Predictive Sales fusion alerts, Missed-Call/Review automation, Email Blast Engine).
5. **The fusion example, in their words:** *"When Stellantis visits your boiler tune-up page AND has an active RFP on MITN.info, you get one SMS with both signals. No competitor can do this."*
6. **One-click close:** *"Reply YES and I'll send the setup form tonight + Stripe link in the morning."*
7. P.S. with the demo links (post-recolor).

**Files:**
- New email template `supabase/functions/_shared/transactional-email-templates/djconley-proposal.tsx` (one-shot, but using the system so it logs/tracks)
- Trigger: one-time invoke from admin panel button "Send DJ Conley proposal" in `OnePressLauncher.tsx` or new tiny `src/components/admin/SendProposalButton.tsx`
- Subject: `D.J. Conley + Detroit Web Agency — exactly what I'd build`

---

## §3. Forever-Pricing infrastructure (§1 of v2 — build it for real)

This is the moat. Build for every client, not just DJ Conley.

**Tables:**
- `product_changelog` (id, date, product, title, body, tags[])
- `client_price_locks` (client_id, locked_monthly_price, locked_since, notes)

**Pages/components:**
- `src/pages/Changelog.tsx` — public, SEO'd, "what we shipped this week" page
- `src/components/owner-portal/WhatsNewBanner.tsx` — top-of-dashboard, last 3 ships
- `src/components/owner-portal/LockedPriceBadge.tsx` — "Locked at $499/mo since [date] — forever"
- Add **"Lock today's price. Every future upgrade is free. Forever."** banner to `/managed-website`, `/predictive-sales`, all radar pages

**Edge function + cron:**
- `monthly-upgrade-recap-sender` — first of month 8am ET, transactional email to every locked-price client listing the upgrades they got free that month
- Stripe metadata: `price_locked_forever: true` on every Managed Website subscription

**Welcome email update:** add forever-pricing callout to `dwa-welcome` template.

---

## §4. Predictive Sales umbrella + decision matrix

- Rename in sidebar, landing pages, demos, emails:
  - Demand Radar → "Predictive Sales — Active Buyers Right Now"
  - Buyer Radar → "Predictive Sales — Companies in Buying Mode"
  - Industry Pulse → "Predictive Sales — Market Trend Map"
  - TechAlert → "Predictive Hiring (license-gated trades only)"
  - SiteRadar → "Predictive Sales — Who's on YOUR Site Right Now"
- New `src/pages/PredictiveSales.tsx` with industry → recommended-products decision matrix
- `src/data/productCatalog.ts` + `dwa_product_catalog` table with `recommended_industries[]` / `excluded_industries[]`
- `demoConfigs/djconley.json` — hide TechAlert (boiler ops aren't license-gated talent radar fits for them)

---

## §5. FieldDesk pivot — "Marketing Layer for eWay" (don't fight eWay)

- New `src/pages/MarketingLayerForEway.tsx` — hero "Keep eWay. Add the layer it doesn't have."
- The 5 things eWay doesn't do: SMS arrival/leaving, automated review requests, missed-call text-back, Predictive Sales fusion alerts, SiteRadar visitor intel
- **Honest** rewrite of `src/pages/FieldDeskVsEway.tsx` — pull false claims, link to Marketing Layer page for happy eWay shops
- New `src/pages/FieldDeskMigration.tsx` + `fielddesk-import-eway` edge function — future upgrade path (when DJ Conley wants to consolidate later, not now)
- Schema: `dual_run_until` + `migration_status` enum on `field_crm_clients`

---

## §6. SiteRadar Pro — 20 enhancements (with HONEST framing)

### ⚠ Honest framing (per your note)
**Do NOT say:** "We identify who visited your site."
**DO say:** "We identify the company instantly. Then we surface the most likely decision-maker to call." Apollo enriches the org. LinkedIn Insight Tag identifies the 10–20% of visitors who happen to be logged into LinkedIn in the same browser. RB2B is the only thing that gets close to "person X visited" — and that's the optional $300/mo add-on the client opts into transparently.

This framing goes in: SiteRadar landing page, Owner Dashboard tooltips, demo scripts, sales emails. No overselling.

### Tier A — Identification (days 1–2)
1. Company ID via Clearbit Reveal *(shipped)*
2. **Apollo "most likely decision-maker" lookup** — surface Facilities Director / VP Ops / Procurement *for the company* (clearly labeled as "likely contact at this org," not "the visitor")
3. **LinkedIn Insight Tag** — partial person-ID for logged-in LinkedIn visitors (clearly labeled "LinkedIn-identified," ~10–20% of traffic)
4. **Returning visitor fingerprinting** — same browser 2× in 7 days = hot
5. **Account rollup view** — group all visits by company over time

### Tier B — Cross-Radar Fusion (THE WEDGE — days 2–3)
6. **Demand Radar overlay** — "Stellantis visited /boiler-service. Stellantis also has a $2.4M RFP on MITN.info."
7. **Industry Pulse overlay** — "Auto manufacturing up 12% in SE MI; 3 auto suppliers visited this week."
8. **Buyer Radar overlay** — visitor matches a flagged buyer signal
9. **Page-level intent scoring** — `/pricing` + `/service-contracts` = high
10. **Unified ONE SMS** combining all radars

### Tier C — Outreach Triggers (days 3–4)
11. Instant SMS to client on high-intent visit (<60s)
12. AI-drafted cold email (Haiku) with page + industry context, owner reviews + sends
13. 24-hour case-study auto-drop via Resend
14. Visitor → outreach queue with Apollo-enriched contact

### Tier D — Admin Power (days 4–5)
15. Visitor heatmap by page
16. Hot-zone alerts ("3 manufacturers on /boiler-tune-up in 24h")
17. Saved-search rules ("alert me when any hospital or auto-Tier-1 visits")
18. Weekly Monday PDF digest — top accounts, pages, recommended outreach, est. pipeline value
19. Competitor watchlist (flag known-competitor IPs separately)
20. Seasonal RFP calendar overlay

**Files:** rewrite `visitor-identify/index.ts`; new edge functions `siteradar-fusion-alert`, `siteradar-draft-outreach`, `siteradar-account-rollup`, `siteradar-weekly-digest-pro`, `siteradar-case-study-dropper`. New tables: `siteradar_visitor_persons`, `siteradar_account_score`, `siteradar_alert_rules`, `siteradar_draft_outreach`, `siteradar_visitor_fingerprints`, `siteradar_competitor_watchlist`, `siteradar_case_studies`. Major rewrite: `src/pages/MySiteRadar.tsx` → tabs Live / Accounts / Persons / Drafts / Rules / Heatmap / Digest.

---

## §7. Owner Dashboard — embedded in their website at `/admin`

Magic-link login. Their website IS the hub.

**Tabs:**
- **Dashboard** — today's visitors, hottest accounts, recent leads, review score, est. pipeline + **WhatsNewBanner (§3)** + **LockedPriceBadge (§3)**
- **Visitor Intelligence** — full SiteRadar Pro (Live / Accounts / Persons), with honest "company-level + likely contact" framing in every tooltip
- **Predictive Sales** — Demand + Buyer Radar fused feed, industry-filtered
- **Email Campaigns** — see §8
- **Review Queue** — pending requests, resend failures, conversion tracking
- **Job Snapshot (eWay-lite)** — *future, optional* read-only via eWay CSV/webhook
- **Content** — TipTap inline editor for hero/services/photos. They edit their own site without calling.
- **Settings + Billing** — colors, logo, alert routing, Locked Price badge

**Files:** `src/components/owner-portal/OwnerLayout.tsx`, pages `Dashboard.tsx`, `OwnerVisitorIntel.tsx`, `OwnerPredictiveSales.tsx`, `OwnerEmailCampaigns.tsx`, `OwnerReviews.tsx`, `OwnerJobs.tsx`, `OwnerContent.tsx`, `OwnerSettings.tsx`. Edge functions `owner-portal-magic-link`, `owner-portal-content-update`. Tables `managed_websites`, `managed_website_pages`, `managed_website_content_blocks`. Extend `field_crm_clients` with `managed_website_id`, `price_locked_forever`, `locked_monthly_price`. New `create-managed-website-checkout` supporting both pricing options. New `src/pages/ManagedWebsite.tsx` landing page with both pricing options + Forever Pricing promise hero.

---

## §8. Email Blast Engine (owner-controlled, in dashboard)

- **Contact lists** — auto-pull FieldDesk customers + CSV upload + tag segments
- **Templates** — boiler-service seasonal tune-up, off-season promo, emergency-prep, holiday + blank
- **AI assist** — Haiku drafts body from one-line prompt
- **Schedule modes:** manual blast / auto-recurring (toggle ON/OFF) / trigger-based (6 mo after service, 18-mo dormant, post-quote)
- **Master on/off toggle** for all automation
- **Compliance** — mandatory unsub footer (system-managed), `suppressed_emails` honored
- **Stats** — opens, clicks, unsubs, replies per blast

**Files:** `owner-portal-email-blast` edge function, tables `email_blast_campaigns`, `email_blast_recipients`, `email_blast_schedules`, `email_blast_templates`. Components `BlastComposer.tsx`, `BlastScheduler.tsx`, `BlastStats.tsx`, `ContactListManager.tsx`.

---

## Build Order (revised)

1. **§1 Recolor DJ Conley demos** (~1 hour) — blocker for everything else
2. **§2 Send Pat the proposal email** (~1 hour) — must hit his inbox within 24h of meeting
3. **§3 Forever-Pricing infrastructure** (~half day) — the moat, build once, every client benefits
4. **§4 Predictive Sales umbrella** (~2 hours) — positioning consistency
5. **§5 Marketing Layer for eWay + honest comparison** (~half day)
6. **§7 Managed Website checkout + Owner Dashboard shell + landing page** (~full day) — the new product
7. **§6 SiteRadar Pro Tiers A + B (with honest framing)** (~full day) — the wedge
8. **§8 Email Blast Engine** (~half day)
9. **§6 SiteRadar Pro Tiers C + D** (~full day)
10. **§7 Remaining dashboard tabs (Reviews, Jobs, Settings)** (~half day)
11. **§5 FieldDesk migration kit** (~half day, future-pitch only)

Total: ~5.5 build days after the two same-day items (§1, §2).

---

## What changed from v2

- **§1 (NEW, top of list):** Recolor DJ Conley demos to navy/orange BEFORE anything else.
- **§2 (NEW, top of list):** Send Pat the one-page proposal email tonight — was completely missing from v2.
- **§6 honest framing:** Person-level ID is now framed as "company instantly + likely decision-maker" not "we know who visited." Goes in landing pages, tooltips, demo scripts, sales emails.
- Pricing locked to $499/mo or $499+$199/mo (your call).
- Forever Pricing infrastructure stays as a build-it-once moat.

---

Approve and I'll start §1 and §2 in parallel right now.
