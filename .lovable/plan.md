
# Pat / D.J. Conley — "The Pitch" Email v4 (locked to actual meeting notes)

## What I got wrong, now corrected

You were right to stop me. Re-read `.lovable/plan.md` (the **post-meeting** plan, not the pre-meeting brief). Locked-in truths:

- **eWay stays.** Pat keeps using it. We do **NOT** replace it. The pivot is "Marketing Layer for eWay — don't fight eWay."
- **FieldDesk runs in parallel** inside his admin panel. He uses both side-by-side, on his timeline. If/when he wants to consolidate, that's *his* call, not ours. (Schema already has `dual_run_until` + `migration_status` on `field_crm_clients` for exactly this.)
- **FieldServio also stays** — full ERP, he needs it.
- **SiteRadar honest framing is mandatory.** Never "we identify who visited." Always "we identify the **company** instantly + surface the **most likely decision-maker**." Person-level only via the optional **+$300/mo RB2B pass-through**.
- **Owner Dashboard already specced** with these tabs: Dashboard · Visitor Intelligence · Predictive Sales · Email Campaigns · Review Queue · Job Snapshot (eWay-lite read-only) · Content · Settings/Billing.
- **Pricing is set:** $499/mo all-in OR $499 + $199/mo. Optional RB2B add-on $300/mo at cost.
- **Forever Pricing Promise** is the moat. Locked rate forever, every future ship is free.
- **Predictive Sales umbrella** is the renamed family: Demand Radar / Buyer Radar / Industry Pulse / SiteRadar / TechAlert all roll up under it. **Hide TechAlert in DJ Conley's view** (boiler ops aren't license-gated trades — `hideTechAlert: true` already in `djconley.json`).
- **The wedge** is the cross-radar **Fusion SMS** (Stellantis on /boiler-tune-up + active $2.4M MITN RFP → ONE text).

## Your new ask (Command Center for "all his tabs in one place")

This is a **first-class new feature** in the email and a real expansion of the spec'd "Job Snapshot (eWay-lite)" tab.

**Command Center tab inside `/admin`:**
- A grid of **tab tiles** Pat configures himself: eWay, FieldServio, QuickBooks, Gmail, Google Calendar, BSEED Permits, MITN.info RFPs, his bank, payroll, anything.
- Each tile = one click → opens in embedded iframe **OR** new tab (his choice per tile, since some sites block iframe via X-Frame-Options).
- **Drag-to-reorder, custom labels, custom icons.**
- **Pinned bar across the top** of every admin page so Command Center is one click away from anywhere.
- **SSO where supported** (Google Workspace, Microsoft 365). Where not, deep-link.
- **He sends us the list, we wire them in before launch.**

This sits *alongside* — not instead of — the Job Snapshot (eWay-lite) tab, which read-only mirrors his eWay jobs into the dashboard via CSV/webhook so he sees jobs without leaving.

## The full offer (everything Pat gets in the email)

Aligned to the meeting plan, not invented:

1. **Brand-new website** at djconley.com — his navy `#1B4F8A` + orange `#E07B39`, mobile-perfect, Pat-editable via inline TipTap
2. **Owner Dashboard** at `djconley.com/admin` — magic-link login, all tabs below
3. **Command Center** *(NEW — your ask)* — unified hub for eWay, FieldServio, QuickBooks, etc.
4. **Job Snapshot (eWay-lite)** — read-only mirror of his eWay jobs inside the dashboard so he sees them without switching
5. **FieldDesk — running in parallel with eWay inside the admin panel** — he tries it side-by-side, his timeline. Live tech GPS, auto-SMS to customer (en route / on site / complete), photo-stamped completion. Zero pressure to switch.
6. **SiteRadar Pro** with **honest framing**: company-ID instant + likely-decision-maker via Apollo + LinkedIn Insight Tag partial person-ID for ~10–20% of traffic. Person-level RB2B available as transparent **+$300/mo at cost** add-on.
7. **Predictive Sales fusion alerts** (Demand + Buyer + Industry Pulse + SiteRadar overlaid) — the Stellantis/MITN wedge
8. **Email Blast Engine** — manual / recurring seasonal / trigger-based, master ON/OFF, Pat-controlled
9. **Missed-call text-back <60s + automated review request after every job + 2-way SMS inbox**
10. **Review Queue** module — pending requests, resends, conversion tracking
11. **Content tab** — Pat edits hero text / services / photos himself, no support ticket
12. **Forever Pricing Promise** — contractually locked, every future feature free forever
13. **What's New banner** + **Locked Price badge** in his dashboard so he sees value compounding

## Email structure (top to bottom)

1. **Personal opener** — references the April 22 meeting honestly
2. **Founder Moment callout** — "you're customer #1 of this stack, Forever Pricing locked, we ship daily"
3. **Your Owner Dashboard guided tour** — mock dashboard graphic (HTML/CSS, no external image hosts so nothing breaks in his inbox), tab list visible
4. **Command Center deep-dive** *(NEW)* — mock 3×3 tile grid graphic showing `eWay · FieldServio · QuickBooks · Gmail · Calendar · BSEED · MITN · Bank · Add Tile +`. Explicit ask: *"Send me the list of every tab you bounce between today and I'll wire them all in before launch."*
5. **FieldDesk in parallel with eWay** — mock dispatcher kanban + tech-on-map graphic. Copy: *"eWay keeps doing what it does. FieldDesk lives next to it inside your admin panel. Run both, see which one your crew prefers, on your timeline. If FieldDesk wins, great. If eWay wins, no harm done — you've lost nothing."* Schema already supports this (`dual_run_until`).
6. **SiteRadar Pro** with the **honest framing built in** — mock SMS bubble showing company + likely-decision-maker (NOT "person X visited"). Mention RB2B opt-in for person-level at $300/mo at cost.
7. **Predictive Sales Fusion** — the wedge. Stellantis + MITN $2.4M example. One SMS, all signals tied together.
8. **Email Blast Engine** — mock UI with 3 mode tiles + master kill switch
9. **SMS Center + Reviews + Missed-Call Text-Back** — mock inbox graphic
10. **Demo links + iteration promise** — Demo A `/demo-djconley-v2/index.html`, Demo B `/demo-djconley-v3/index.html`. Mock browser-frame previews. Explicit: *"Tell me what you want changed — color, layout, copy, photos, anything. We rebuild until you say 'that's it.' Unlimited revisions."*
11. **Pricing**: Option A $499/mo all-in · Option B $499 + $199/mo · Optional RB2B +$300/mo at cost · Forever Pricing visual
12. **What ships in next 90 days at no extra cost** (proof of "ship daily"): AI phone answering after-hours, Fusion v2 with more sources, auto-generated quarterly business review PDFs, Mortgage-Radar-style commercial property intel, FieldDesk multi-tech route optimization
13. **Close**: reply `YES A` / `YES B` / `DEMOS: change X` / call (313) 992-1219

## What I will explicitly NOT say in the email

- Will not say we replace eWay
- Will not say we replace FieldServio
- Will not say "we identify who visited your site" (only "the company" + "likely decision-maker")
- Will not pitch TechAlert (boiler ops aren't license-gated; already hidden in `djconley.json`)
- Will not over-claim person-level ID without flagging RB2B as the paid opt-in path

## What gets built (technical)

- **New edge function** `supabase/functions/send-djconley-pitch-v2/index.ts`
  - Mirrors `send-djconley-proposal` infra (Resend, DWA brand shell, BCC `matthewmichels4@gmail.com`, audit row in `notifications`)
  - Long-form HTML body with all sections + mock graphics rendered as inline-styled HTML/CSS divs (mock browser chrome, dashboard panels, SMS bubbles, kanban cards, tile grid, toggle switches — all email-safe, no external image hosts)
  - Plain-text fallback covering the same sections
  - Subject: `Pat — the whole thing, top to bottom (D.J. Conley)`
  - From: `Matt Michels — Detroit Web Agency <matt@detroitwebagent.com>`
  - To: `pmichels@djconley.com`
- **`supabase/config.toml`** — add `[functions.send-djconley-pitch-v2]` with `verify_jwt = false`
- **No DB schema changes, no UI changes** — all the underlying infrastructure (Owner Dashboard tabs, Command Center spec, Forever Pricing tables, Predictive Sales rename, dual-run schema) is already on the build plan and lives in separate work — this email is the sales artifact only.

## Send sequence

1. Deploy function
2. **First invoke → `matthewmichels4@gmail.com`** (preview to your inbox)
3. You approve / I tweak
4. **Second invoke → `pmichels@djconley.com`**

## Acceptance

- Function deploys cleanly
- Preview lands in your inbox with all sections rendered correctly on Gmail web + iOS Mail (no broken visuals, no image-blocking issues since everything is inline CSS)
- Audit row appears in `notifications` after each send
- After your OK → live send to Pat
